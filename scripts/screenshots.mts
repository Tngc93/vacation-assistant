/**
 * README images: `npm run build && npm run screenshots`.
 *
 * Starts the production build (`next start`) on its own port with the labelled sample data on — flights
 * (`VA_FLIGHTS_FIXTURES=1`), exchange rates (`VA_RATES_FIXTURES=1`, the saved TCMB bulletin) and the keyless AI
 * demo (`VA_AI_MOCK=1`) — so no secret is needed and no price comes from a live source. The AI panel talks to a
 * fake OpenAI answered inside the browser (`page.route`) with an obviously fake key; no request leaves the machine
 * for an AI provider.
 *
 * Network: city and place photos come from Wikimedia Commons and the map tiles from OpenFreeMap, live, so the
 * script wants a connection (without one the pages show their gradient and dot-map fallbacks). Everything else is
 * the repo's own data.
 *
 * Determinism: the browser clock is pinned to 10:00 Istanbul time on the day of the run (`SCREENSHOTS_NOW`
 * overrides it), and the trip starts on the first Friday at least five weeks later, for four nights, so dates and
 * clocks on the pages repeat for a given day. The server renders with its real clock (the trip must lie in the
 * future), and Commons photos and OSM data change with each monthly data refresh.
 *
 * Output: optimised WebP files in docs/screenshots/ (sharp, which Next.js already installs for image
 * optimisation), the animated demo (docs/screenshots/demo.webp) and the banner, rendered from an HTML template
 * (scripts/screenshots/banner.html) in DESIGN.md's colours with a crop of the plan screenshot.
 *
 * `SCREENSHOTS_ONLY=step-2,demo` makes only those images (the banner needs step-2-places.png from a full run, kept
 * in the scratch folder `.screenshots-tmp/`).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { readThemeTokens } from "../src/lib/pwa/tokens";

const ROOT = process.cwd();
const OUT = join(ROOT, "docs/screenshots");
const TMP = join(ROOT, ".screenshots-tmp");
const PORT = Number(process.env.SCREENSHOTS_PORT ?? 3510);
const BASE = `http://localhost:${PORT}`;
const ONLY = process.env.SCREENSHOTS_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const want = (name: string) => !ONLY || ONLY.some((o) => name.startsWith(o));

// ---- The pinned clock and the trip ------------------------------------------------------------------------------

function istanbulDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
const NOW = process.env.SCREENSHOTS_NOW ? new Date(process.env.SCREENSHOTS_NOW) : new Date(`${istanbulDate(new Date())}T10:00:00+03:00`);
if (Number.isNaN(NOW.getTime())) throw new Error(`SCREENSHOTS_NOW is not a date: ${process.env.SCREENSHOTS_NOW}`);

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const earliest = addDays(istanbulDate(NOW), 35);
const DEPART = addDays(earliest, (5 - new Date(`${earliest}T00:00:00Z`).getUTCDay() + 7) % 7);
const RETURN = addDays(DEPART, 4);
const TRIP = `depart=${DEPART}&return=${RETURN}`;
/** "Friday, 18 December 2026": react-day-picker's day button names in en-GB. */
const dayButtonName = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

// ---- Server -----------------------------------------------------------------------------------------------------

async function startServer(): Promise<ChildProcess> {
  if (!existsSync(join(ROOT, ".next/BUILD_ID"))) throw new Error("No production build: run `npm run build` first.");
  const server = spawn(process.execPath, [join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, VA_FLIGHTS_FIXTURES: "1", VA_RATES_FIXTURES: "1", VA_AI_MOCK: "1" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/en`)).ok) return server;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error(`The server did not start on ${BASE}.`);
}

// ---- Browser helpers --------------------------------------------------------------------------------------------

type PageOptions = { width?: number; height?: number; scheme?: "light" | "dark"; dpr?: number; serviceWorkers?: boolean; locale?: "en-GB" | "tr-TR" };

async function open(browser: Browser, path: string, o: PageOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: o.width ?? 1440, height: o.height ?? 900 },
    deviceScaleFactor: o.dpr ?? 1,
    colorScheme: o.scheme ?? "light",
    reducedMotion: "no-preference",
    locale: o.locale ?? "en-GB",
    timezoneId: "Europe/Istanbul",
    serviceWorkers: o.serviceWorkers ? "allow" : "block",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  await page.goto(`${BASE}${path}`);
  return { context, page };
}

/** Fonts in, every image on screen decoded (or failed). */
async function settle(page: Page, ms = 300) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const onScreen = [...document.images].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
    });
    // Inline: a named helper here would make tsx emit a `__name` call the page does not have.
    await Promise.race([
      Promise.all(
        onScreen.map((img) =>
          img.complete
            ? null
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              }),
        ),
      ),
      new Promise((r) => setTimeout(r, 8000)),
    ]);
  });
  await page.waitForTimeout(ms);
}

/** The plan page with its first day and its city photo (or the gradient fallback) in place. */
async function planReady(page: Page) {
  await page.locator("#gun-gun-plan").getByRole("region").first().waitFor();
  await page.locator('[data-state="photo"], [data-state="gradient"]').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  await settle(page, 600);
}

/** Wakes MapLibre (it waits for the first pointer move) and gives its tiles a moment. */
async function wakeMap(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.locator(".maplibregl-canvas").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(3500);
}

/** Puts an element's top just under the sticky menu (the plan's in-page nav). */
async function scrollToTop(page: Page, locator: Locator, offset = 64) {
  await locator.evaluate((el, off) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off), offset);
  await page.waitForTimeout(500);
  await settle(page, 300);
}

/** A full-width clip of the page from `locator`'s top, `margin` px around it, at most `max` px tall. */
async function clipAround(page: Page, locator: Locator, { margin = 16, max = 1300, offset = 96 } = {}) {
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, max + offset) });
  await scrollToTop(page, locator, offset);
  const box = (await locator.boundingBox())!;
  const top = Math.max(0, box.y - margin);
  return page.screenshot({ clip: { x: 0, y: top, width: viewport.width, height: Math.min(box.height + 2 * margin, max) } });
}

/** An element with some room around it (for the narrower feature images). */
async function shootElement(page: Page, locator: Locator, margin = 20, offset = 140) {
  await scrollToTop(page, locator, offset);
  const box = (await locator.boundingBox())!;
  const viewport = page.viewportSize()!;
  const x = Math.max(0, box.x - margin);
  const y = Math.max(0, box.y - margin);
  return page.screenshot({ clip: { x, y, width: Math.min(box.width + 2 * margin, viewport.width - x), height: Math.min(box.height + 2 * margin, viewport.height - y) } });
}

// ---- Output -----------------------------------------------------------------------------------------------------

const written: Array<{ name: string; bytes: number; width: number; height: number }> = [];

async function save(name: string, png: Buffer, { width, quality = 80 }: { width?: number; quality?: number } = {}) {
  await writeFile(join(TMP, `${name}.png`), png);
  let image = sharp(png);
  if (width) image = image.resize({ width, withoutEnlargement: true });
  const file = join(OUT, `${name}.webp`);
  const info = await image.webp({ quality, effort: 6, smartSubsample: true }).toFile(file);
  written.push({ name: `${name}.webp`, bytes: info.size, width: info.width, height: info.height });
  console.log(`  ${name}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

// ---- The fake OpenAI (no key, no network) ------------------------------------------------------------------------

const FAKE_KEY = "sk-demo-not-a-real-key";

async function fakeOpenAi(page: Page) {
  await page.route("https://api.openai.com/v1/models", (route) =>
    route.fulfill({ json: { data: [{ id: "gpt-5", created: 2 }, { id: "gpt-5-mini", created: 1 }] } }),
  );
  await page.route("https://api.openai.com/v1/chat/completions", (route) => {
    type Data = { days: Array<{ day: number; window: string | null }>; candidates: Array<{ id: string; closedDays: number[] }>; plan?: Array<{ stops: Array<{ id: string }> }> };
    const body = route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> };
    const user = body.messages[1].content;
    const data = JSON.parse(user.slice(user.indexOf("DATA:\n") + 6)) as Data;
    let answer: unknown;
    if (user.startsWith("REQUEST:")) {
      const day2 = data.plan![1]?.stops ?? data.plan![0].stops;
      answer = { commands: [{ op: "remove", id: day2[day2.length - 1].id }], reply: "Done: one stop fewer on day 2, so the afternoon is calmer." };
    } else {
      answer = {
        days: data.days.map((d, i) => {
          const open = data.candidates.filter((c) => !c.closedDays.includes(d.day));
          const stops = d.window ? open.slice(i * 4, i * 4 + 4).map((c) => c.id) : [];
          return { day: d.day, stops, reason: stops.length ? "The best-known places, close to each other." : "Travel day." };
        }),
      };
    }
    return route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(answer) } }] } });
  });
}

// ---- The shots ----------------------------------------------------------------------------------------------------

const plan = (to: string, extra = "") => `/en/plan?to=${to}&${TRIP}${extra}`;

async function homeChosen(page: Page) {
  await page.locator("canvas[data-home-background][data-ready]").waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.getByRole("button", { name: "Barcelona", exact: true }).click();
  await page.getByRole("button", { name: dayButtonName(DEPART) }).first().click();
  await page.getByRole("button", { name: dayButtonName(RETURN) }).first().click();
  await page.keyboard.press("Escape");
}

async function shots(browser: Browser) {
  if (want("step-1")) {
    const { context, page } = await open(browser, "/en");
    await homeChosen(page);
    await page.mouse.move(1100, 330);
    await page.waitForTimeout(5000);
    await settle(page);
    await save("step-1-choose", await page.screenshot());
    await context.close();
  }

  if (want("step-2") || want("banner")) {
    const { context, page } = await open(browser, plan("BCN"));
    await planReady(page);
    await wakeMap(page, 1200, 650);
    // A card under the pointer marks its dot on the map.
    await page.locator("#yerler li").nth(1).hover().catch(() => undefined);
    await page.waitForTimeout(800);
    await save("step-2-places", await page.screenshot());
    await context.close();
  }

  if (want("step-3")) {
    const { context, page } = await open(browser, plan("BCN"), { scheme: "dark" });
    await planReady(page);
    const section = page.locator("#gun-gun-plan");
    await scrollToTop(page, section);
    await wakeMap(page, 1100, 500);
    await save("step-3-day-by-day-dark", await clipAround(page, section, { max: 1100 }));
    await context.close();
  }

  if (want("step-4") || want("step-5") || want("step-6")) {
    const { context, page } = await open(browser, plan("BCN"));
    await planReady(page);
    if (want("step-4")) await save("step-4-stays", await clipAround(page, page.locator("#konaklama"), { max: 900 }));
    if (want("step-5")) await save("step-5-flights", await clipAround(page, page.locator("#ucuslar"), { max: 1200 }));
    if (want("step-6")) {
      const budget = page.locator("#butce");
      await scrollToTop(page, budget);
      await page.getByLabel("Stay per night (all rooms)").fill("140");
      await page.getByLabel("Daily spending per person").fill("70");
      await page.getByLabel("Daily spending per person").press("Tab");
      await page.waitForTimeout(600);
      await save("step-6-budget", await clipAround(page, budget, { max: 1200 }));
    }
    await context.close();
  }

  if (want("feature-ai")) {
    const { context, page } = await open(browser, plan("BCN"), { height: 1000 });
    await fakeOpenAi(page);
    await planReady(page);
    const section = page.locator("#gun-gun-plan");
    await scrollToTop(page, section);
    await section.getByRole("button", { name: /^Plan with AI/ }).first().click();
    const panel = page.getByRole("region", { name: "Plan with AI" });
    await panel.getByRole("button", { name: "OpenAI" }).click();
    await panel.getByLabel("API key").fill(FAKE_KEY);
    await panel.getByRole("button", { name: "Connect" }).click();
    await panel.getByRole("button", { name: "Connected, continue" }).click();
    await panel.getByRole("button", { name: "Plan with AI" }).click();
    await section.getByText("The best-known places, close to each other.").first().waitFor();
    await panel.getByLabel("Change the plan by chatting").fill("Make day 2 calmer");
    await panel.getByRole("button", { name: "Apply" }).click();
    await panel.getByText("Done: one stop fewer on day 2").waitFor();
    await page.mouse.move(10, 10);
    await scrollToTop(page, section);
    await settle(page, 800);
    await save("feature-ai", await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 1000 } }));
    await context.close();
  }

  if (want("feature-sub-stops")) {
    const { context, page } = await open(browser, plan("MOW"));
    await planReady(page);
    const day = page.locator("#gun-gun-plan").getByRole("region", { name: /^Day \d/ }).filter({ has: page.getByRole("list", { name: /^Inside / }) }).first();
    await save("feature-sub-stops", await shootElement(page, day), { width: 900 });
    await context.close();
  }

  if (want("feature-far")) {
    const { context, page } = await open(browser, plan("VIE"));
    await planReady(page);
    const day = page.locator("#gun-gun-plan").getByRole("region", { name: /^Day \d/ }).filter({ hasText: /~\d+ KM FROM CENTRE/ }).first();
    await save("feature-far", await shootElement(page, day), { width: 900 });
    await context.close();
  }

  if (want("feature-events")) {
    const { context, page } = await open(browser, plan("TLL"));
    await planReady(page);
    await wakeMap(page, 1200, 650);
    // The first card is the trip's event; its details open over the map.
    await page.locator("#yerler li").first().click();
    await page.waitForTimeout(1200);
    await save("feature-events", await shootElement(page, page.locator("#yerler"), 0, 80), { width: 1200 });
    await context.close();
  }

  if (want("feature-cocktails")) {
    const { context, page } = await open(browser, plan("BCN", "&cats=cocktail"));
    await planReady(page);
    await wakeMap(page, 1200, 650);
    await page.locator("#yerler li").first().click().catch(() => undefined);
    await page.waitForTimeout(1200);
    await save("feature-cocktails", await shootElement(page, page.locator("#yerler"), 0, 80), { width: 1200 });
    await context.close();
  }

  if (want("feature-origin")) {
    const { context, page } = await open(browser, plan("BCN"));
    await planReady(page);
    const flights = page.locator("#ucuslar");
    await scrollToTop(page, flights);
    const from = page.getByLabel("From", { exact: true });
    await from.click();
    await from.fill("");
    await from.pressSequentially("lon", { delay: 80 });
    await page.getByRole("listbox", { name: "Departure cities" }).getByRole("option").first().waitFor();
    await page.waitForTimeout(500);
    const box = (await flights.boundingBox())!;
    await save("feature-origin", await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: 470 } }), { width: 1000 });
    await context.close();
  }

  if (want("tr-home")) {
    const { context, page } = await open(browser, "/", { locale: "tr-TR" });
    await page.locator("canvas[data-home-background][data-ready]").waitFor({ timeout: 15_000 }).catch(() => undefined);
    await page.mouse.move(1100, 330);
    await page.waitForTimeout(5000);
    await settle(page);
    await save("tr-home", await page.screenshot());
    await context.close();
  }

  if (want("tr-plan")) {
    const { context, page } = await open(browser, `/plan?to=BCN&${TRIP}`, { locale: "tr-TR" });
    await planReady(page);
    await wakeMap(page, 1200, 650);
    await save("tr-plan", await page.screenshot());
    await context.close();
  }

  if (want("mobile-home")) {
    const { context, page } = await open(browser, "/en", { width: 375, height: 812, dpr: 2 });
    await page.locator("canvas[data-home-background][data-ready]").waitFor({ timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(4000);
    await settle(page);
    await save("mobile-home", await page.screenshot());
    await context.close();
  }

  if (want("mobile-plan")) {
    const { context, page } = await open(browser, plan("BCN"), { width: 375, height: 812, dpr: 2 });
    await planReady(page);
    await save("mobile-plan", await page.screenshot());
    await context.close();
  }

  if (want("mobile-pwa")) {
    // The installed app: `display-mode: standalone` emulated over the DevTools protocol (no browser UI in a
    // headless screenshot anyway), the plan saved by the service worker, then reopened offline.
    const { context, page } = await open(browser, plan("BCN"), { width: 375, height: 812, dpr: 2, serviceWorkers: true });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "display-mode", value: "standalone" }] }).catch(() => undefined);
    await planReady(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    const url = page.url();
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const saved = await page.evaluate(async (u) => {
        for (const name of await caches.keys()) if (await (await caches.open(name)).match(u)) return true;
        return false;
      }, url);
      if (saved) break;
      await page.waitForTimeout(300);
    }
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("status").filter({ hasText: "You are offline" }).first().waitFor();
    await settle(page, 2500);
    await save("mobile-pwa-offline", await page.screenshot());
    await context.setOffline(false);
    await context.close();
  }
}

// ---- The animated demo --------------------------------------------------------------------------------------------

async function demo(browser: Browser) {
  const width = 1280;
  const height = 800;
  const { context, page } = await open(browser, "/en", { width, height });
  const frames: Buffer[] = [];
  const delays: number[] = [];
  const snap = async (delay = 110, count = 1) => {
    for (let i = 0; i < count; i++) {
      frames.push(await page.screenshot());
      delays.push(delay);
    }
  };
  await page.locator("canvas[data-home-background][data-ready]").waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.mouse.move(980, 300);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i++) await snap(150);

  // Where: type the city and pick it.
  const city = page.getByPlaceholder("City, country or code");
  await city.click();
  for (const ch of "Barc") {
    await city.pressSequentially(ch);
    await snap(140);
  }
  await page.getByRole("option", { name: /Barcelona/ }).first().waitFor();
  await snap(400);
  await page.getByRole("option", { name: /Barcelona/ }).first().click();
  await snap(300);

  // When: the two dates in the calendar.
  const depart = page.getByRole("button", { name: /^Depart/ });
  if (!(await page.getByRole("button", { name: dayButtonName(DEPART) }).first().isVisible())) await depart.click();
  await snap(500);
  await page.getByRole("button", { name: dayButtonName(DEPART) }).first().click();
  await snap(400);
  await page.getByRole("button", { name: dayButtonName(RETURN) }).first().click();
  await snap(400);
  // The priority route draws from the departure city.
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(90);
    await snap(120);
  }

  // Plan.
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await planReady(page);
  await page.mouse.move(1050, 560);
  await page.locator(".maplibregl-canvas").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  await snap(1600);
  const next = page.getByRole("button", { name: /^Next place/ });
  for (let i = 0; i < 3; i++) {
    await next.click().catch(() => undefined);
    await page.waitForTimeout(150);
    await snap(110);
    await page.waitForTimeout(250);
    await snap(450);
  }

  // Down through the page: the plan, stays, flights and the budget.
  const total = await page.evaluate(() => document.querySelector("#butce")!.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 40);
  const stops = await page.evaluate(() =>
    ["#gun-gun-plan", "#konaklama", "#ucuslar", "#butce"].map((s) => Math.round(document.querySelector(s)!.getBoundingClientRect().top + window.scrollY - 72)),
  );
  let y = 0;
  const step = 70;
  while (y < total) {
    const nextStop = stops.find((s) => s > y && s <= y + step);
    y = nextStop ?? Math.min(total, y + step);
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
    await settle(page, 0);
    await snap(nextStop !== undefined ? 1400 : 70);
  }
  await snap(2600);
  await context.close();

  const animated = await sharp(frames, { join: { animated: true } }).webp({ quality: 62, effort: 6, loop: 0, delay: delays, smartSubsample: true, minSize: true, mixed: true }).toBuffer();
  await writeFile(join(OUT, "demo.webp"), animated);
  written.push({ name: "demo.webp", bytes: animated.length, width, height });
  console.log(`  demo.webp  ${width}×${height}  ${frames.length} frames  ${(animated.length / 1024 / 1024).toFixed(2)} MB`);
}

// ---- The banner ---------------------------------------------------------------------------------------------------

async function banner(browser: Browser) {
  const shot = await readFile(join(TMP, "step-2-places.png"));
  const crop = await sharp(shot).extract({ left: 0, top: 0, width: 1440, height: 900 }).resize({ width: 1100 }).png().toBuffer();
  const font = async (file: string) => (await readFile(join(ROOT, "assets/og", file))).toString("base64");
  let html = await readFile(join(ROOT, "scripts/screenshots/banner.html"), "utf8");
  html = html
    .replace("{{FRAUNCES}}", await font("fraunces-latin-400-normal.woff"))
    .replace("{{MONO}}", await font("geist-mono-latin-400-normal.woff"))
    .replace("{{SHOT}}", crop.toString("base64"))
    .replace("{{TOKENS}}", Object.entries(readThemeTokens(await readFile(join(ROOT, "src/app/globals.css"), "utf8"), "light")).map(([k, v]) => `--${k}: ${v};`).join(" "));
  const context = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(200);
  await save("banner", await page.screenshot(), { quality: 85 });
  await context.close();
}

// ---- Run ------------------------------------------------------------------------------------------------------------

await mkdir(OUT, { recursive: true });
await mkdir(TMP, { recursive: true });
console.log(`Trip ${DEPART} → ${RETURN}; browser clock pinned to ${NOW.toISOString()}.`);
const server = await startServer();
const browser = await chromium.launch();
try {
  await shots(browser);
  if (want("banner")) await banner(browser);
  if (want("demo")) await demo(browser);
} finally {
  await browser.close();
  server.kill();
}
const sizes = await Promise.all(written.map(async (w) => (await stat(join(OUT, w.name))).size));
console.log(`${written.length} files, ${(sizes.reduce((a, b) => a + b, 0) / 1024 / 1024).toFixed(2)} MB.`);
