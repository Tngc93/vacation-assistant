import { expect, test, type Page } from "./fixtures";

/**
 * The polish rules (DESIGN.md "Plan background" and "Type"): no card inside a plan section card except objects, no
 * text under 12px on phones, and the phone atmosphere clearly there above the top card and between the cards.
 */

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const dates = `depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
const plan = (prefix = "", extra = "") => `${prefix}/plan?from=IST&to=BCN&${dates}&pax=2${extra}`;

async function sectionsReady(page: Page) {
  for (const id of ["yerler", "gun-gun-plan", "konaklama", "ucuslar", "butce"]) await expect(page.locator(`main section#${id}`)).toBeVisible();
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Havalimanı başına en ucuz bilet" })).toBeVisible();
}

/**
 * Framed boxes inside a plan section card that hold content of their own (a paragraph, a heading, a list): every
 * side bordered, on screen, not an object (`data-object-card`: tickets, the receipt, web results, maps) or inside
 * one, and not a popup. Fields, buttons, chips and the steppers hold no such content, so they never count.
 */
async function nestedCards(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const section of document.querySelectorAll<HTMLElement>("[data-plan-section]")) {
      for (const el of section.querySelectorAll<HTMLElement>("*")) {
        if (el.closest("[data-object-card], [role=listbox], [role=dialog]")) continue;
        const s = getComputedStyle(el);
        const framed = (["Top", "Right", "Bottom", "Left"] as const).every(
          (side) =>
            parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 1 &&
            s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" &&
            s.getPropertyValue(`border-${side.toLowerCase()}-color`) !== "rgba(0, 0, 0, 0)",
        );
        const box = el.getBoundingClientRect();
        if (!framed || box.width < 2 || box.height < 2) continue;
        if (el.querySelector("p, h3, h4, ul, ol, dl, li, section")) found.push(`#${section.id}: <${el.tagName.toLowerCase()} class="${el.className}">`);
      }
    }
    return found;
  });
}

for (const [width, height] of [
  [375, 812],
  [1440, 900],
] as const) {
  test(`no card inside a plan section card, only objects, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(plan());
    await sectionsReady(page);
    expect(await nestedCards(page)).toEqual([]);
    // Opened: the full flight list (tickets are objects) and the stays' web search (VA_AI_MOCK).
    await page.getByRole("button", { name: "Tüm uçuşları gör" }).click();
    await expect(page.locator("#tum-ucuslar article").first()).toBeVisible();
    await page.locator("#konaklama").getByRole("button", { name: "Web'de ara" }).click();
    await expect(page.locator("#konaklama-web")).toBeVisible();
    expect(await nestedCards(page)).toEqual([]);
    // The objects are still framed: they are things on the card, not frames around its content.
    await expect(page.locator("#ucuslar [data-object-card]").first()).toHaveCSS("border-top-style", "solid");
    await expect(page.locator("#butce [data-object-card]")).toHaveCount(1);
  });
}

test("the AI side panel is a column beside the days, not a second card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(plan());
  await sectionsReady(page);
  await page.locator("#gun-gun-plan").getByRole("button", { name: "Yapay zekâ ile planla" }).click();
  const panel = page.locator("#yapay-zeka");
  await expect(panel).toBeVisible();
  expect(await nestedCards(page)).toEqual([]);
  await expect(panel).toHaveCSS("border-top-width", "0px");
  // One hairline on its left separates it from the days.
  await expect(panel.locator("xpath=..")).toHaveCSS("border-left-width", "1px");
});

/** Every visible text on the page whose font is under `min` pixels: its tag, size and first words. */
async function smallText(page: Page, min: number) {
  return page.evaluate((min) => {
    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const own = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim());
      if (!own) continue;
      const box = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      // Visually hidden text (sr-only, 1px) and hidden elements are not read on screen.
      if (box.width <= 2 || box.height <= 2 || s.visibility === "hidden" || el.closest("[hidden], template, script, style, noscript")) continue;
      const size = parseFloat(s.fontSize);
      if (size < min) found.push(`<${el.tagName.toLowerCase()}> ${size}px "${el.textContent!.trim().slice(0, 30)}"`);
    }
    return found;
  }, min);
}

for (const [name, path] of [
  ["home", "/"],
  ["English home", "/en"],
  ["plan", plan()],
  ["English plan", plan("/en")],
  ["404", "/bu-sayfa-yok"],
  ["offline page", "/offline"],
] as const) {
  test(`no text under 12px on a 375px phone: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    if (path.includes("/plan")) {
      await expect(page.locator("main section#butce")).toBeVisible();
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      // Closed parts too: the full flight list and a place's details.
      await page.locator("#ucuslar").getByRole("button").filter({ hasText: /Tüm uçuşları gör|See all flights/ }).click();
      await expect(page.locator("#tum-ucuslar article").first()).toBeVisible();
    }
    expect(await smallText(page, 12)).toEqual([]);
  });
}

test("desktop keeps the type scale: the micro size stays 11px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(plan());
  await expect(page.locator("main section#butce")).toBeVisible();
  // The hero's mono info line uses the micro size.
  await expect(page.locator("#yerler h1 + div")).toHaveCSS("font-size", "11px");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator("#yerler h1 + div")).toHaveCSS("font-size", "12px");
});

/**
 * A 16×16 black-and-white checkerboard BMP for every Commons image (as in plan-background.spec.ts): the tritone's two
 * ends both under the atmosphere, so where it shows the screenshot is far from plain paper.
 */
async function servePhotos(page: Page) {
  const size = 16;
  const row = size * 3;
  const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pixels.fill((x + y) % 2 ? 255 : 0, y * row + x * 3, y * row + x * 3 + 3);
  const header = Buffer.alloc(54);
  header.write("BM", 0);
  header.writeUInt32LE(54 + pixels.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(size, 18);
  header.writeInt32LE(size, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixels.length, 34);
  const body = Buffer.concat([header, pixels]);
  await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) =>
    route.fulfill({ status: 200, body, headers: { "content-type": "image/bmp", "access-control-allow-origin": "*" } }),
  );
}

/** The highest WCAG contrast between the page's paper and any pixel of a screenshot: how far it is from plain paper. */
async function farthestFromPaper(page: Page, png: Buffer) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const probe = document.createElement("div");
    probe.style.color = "var(--paper)";
    document.body.append(probe);
    const paper = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
    probe.remove();
    const lin = (v: number) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const p = lum(paper[0], paper[1], paper[2]);
    let max = 1;
    for (let i = 0; i < data.length; i += 4) {
      const l = lum(data[i], data[i + 1], data[i + 2]);
      max = Math.max(max, (Math.max(l, p) + 0.05) / (Math.min(l, p) + 0.05));
    }
    return max;
  }, png.toString("base64"));
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`phones show the atmosphere above the top card and between the cards, ${colorScheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await servePhotos(page);
    await page.goto(plan());
    await expect(page.locator("[data-plan-backdrop]")).toHaveAttribute("data-state", "photo");
    const strip = (await page.locator("[data-route-strip]").boundingBox())!;
    const hero = (await page.locator("#yerler").boundingBox())!;
    // A band of the atmosphere between the route strip and the hero card.
    const band = hero.y - (strip.y + strip.height);
    expect(band).toBeGreaterThanOrEqual(20);
    const right = { x: 375 * 0.62, width: 375 * 0.38 - 4 };
    const above = await page.screenshot({ clip: { ...right, y: strip.y + strip.height + 2, height: band - 4 } });
    expect(await farthestFromPaper(page, above)).toBeGreaterThanOrEqual(2);
    // And in a gap between two section cards.
    const gap = page.locator("[data-section-gap]").first();
    await gap.scrollIntoViewIfNeeded();
    const g = (await gap.boundingBox())!;
    const between = await page.screenshot({ clip: { ...right, y: g.y + 2, height: g.height - 4 } });
    expect(await farthestFromPaper(page, between)).toBeGreaterThanOrEqual(2);
  });
}

/**
 * Controls on a phone smaller than 44 × 44 px to tap, counting the invisible hit area (`touch-target`). Links inside
 * a sentence are exempt (WCAG 2.5.8), so are the maps' own controls (MapLibre) and disabled controls.
 */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("main :is(a[href], button, summary, input:not([type=hidden]), select, [role=button])")) {
      if (el.closest(".maplibregl-map, [hidden]") || el.matches(":disabled, [aria-disabled=true]")) continue;
      // A field's input fills its frame (inside the frame's 1px border): the frame is what is tapped.
      const box = (el.tagName === "INPUT" ? el.parentElement! : el).getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      const parent = el.parentElement!;
      const inSentence = el.tagName === "A" && [...parent.childNodes].some((node) => node !== el && node.nodeType === Node.TEXT_NODE && node.textContent!.trim());
      if (inSentence) continue;
      const after = getComputedStyle(el, "::after");
      const hitW = after.content !== "none" && after.position === "absolute" ? parseFloat(after.width) : 0;
      const hitH = after.content !== "none" && after.position === "absolute" ? parseFloat(after.height) : 0;
      const w = Math.max(box.width, hitW);
      const h = Math.max(box.height, hitH);
      if (w < 43.5 || h < 43.5) found.push(`<${el.tagName.toLowerCase()}> ${Math.round(w)}×${Math.round(h)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
    }
    return found;
  });
}

for (const [name, path] of [
  ["home", "/"],
  ["plan", plan()],
  ["English plan", plan("/en")],
  ["404", "/bu-sayfa-yok"],
] as const) {
  test(`every control is at least 44px to tap on a 375px phone: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    if (path.includes("/plan")) {
      await expect(page.locator("main section#butce")).toBeVisible();
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
    }
    expect(await smallTargets(page)).toEqual([]);
  });
}

/** Berk's decisions on PR #40 (2026-11-06). */
test.describe("design decisions", () => {
  test("the theme is one icon button: system → light → dark → system, from the keyboard, named in both languages", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    const button = header.getByRole("button", { name: /^Tema:/ });
    await expect(button).toHaveCount(1);
    await expect(button).toHaveAccessibleName("Tema: Sistem. Basınca: Açık");
    await expect(button).toHaveAttribute("title", "Tema: Sistem. Basınca: Açık");
    await expect(button.locator("svg")).toHaveCount(1);

    // Tab reaches it from the top of the page (after the wordmark and the language switch); Enter and Space move it on.
    for (let i = 0; i < 6 && !(await button.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(button).toHaveAccessibleName("Tema: Açık. Basınca: Koyu");
    await expect(header.getByRole("status")).toHaveText("Tema: Açık");
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(button).toBeFocused();
    await expect(button).toHaveAccessibleName("Tema: Koyu. Basınca: Sistem");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");

    // Remembered across pages and named in English under /en.
    await page.keyboard.press("Enter");
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("header").getByRole("button", { name: /^Theme:/ })).toHaveAccessibleName("Theme: Light. Press for: Dark");
  });

  test("phones: the cheapest ticket's price starts on the left with its caption beside it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(plan());
    const card = page.getByRole("list", { name: "Havalimanı başına en ucuz bilet" }).locator("li").first();
    await expect(card).toBeVisible();
    const price = card.locator("[data-ticket-price] p").first();
    const caption = card.locator("[data-ticket-price] p").nth(1);
    await expect(caption).toHaveText(/1\sYETİŞKİN$/);
    const [cardBox, priceBox, captionBox] = await Promise.all([card.boundingBox(), price.boundingBox(), caption.boundingBox()]);
    // The price starts at the card's left padding, not at its right edge.
    expect(priceBox!.x - cardBox!.x).toBeLessThan(32);
    // Its caption beside it, on the same line.
    expect(captionBox!.x).toBeGreaterThan(priceBox!.x + priceBox!.width);
    expect(Math.abs(captionBox!.y + captionBox!.height - (priceBox!.y + priceBox!.height))).toBeLessThan(8);
  });

  test("desktop: the cheapest ticket's price stays at the right, beside the airline", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(plan());
    const card = page.getByRole("list", { name: "Havalimanı başına en ucuz bilet" }).locator("li").first();
    await expect(card).toBeVisible();
    const [cardBox, priceBox] = await Promise.all([card.boundingBox(), card.locator("[data-ticket-price] p").first().boundingBox()]);
    expect(cardBox!.x + cardBox!.width - (priceBox!.x + priceBox!.width)).toBeLessThan(40);
  });

  test("the flights' source line and sample band show once, even with the full list open", async ({ page }) => {
    await page.goto(plan());
    const flights = page.locator("#ucuslar");
    await flights.getByRole("button", { name: "Tüm uçuşları gör" }).click();
    await expect(page.locator("#tum-ucuslar").getByRole("heading", { name: "İstanbul Havalimanı" })).toBeVisible();
    await expect(flights.getByText(/^KAYNAK: TRAVELPAYOUTS/)).toHaveCount(1);
    await expect(flights.getByText(/^ÖRNEK VERİ · GELİŞTİRME/)).toHaveCount(1);
  });

  test("phones: no day says it is on the map until the day map is open", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(plan());
    const days = page.locator("#gun-gun-plan");
    await expect(days.getByRole("button", { name: "Haritada göster" }).first()).toBeVisible();
    await expect(days.getByRole("button", { name: "Haritada gösteriliyor" })).toHaveCount(0);
    await days.getByRole("button", { name: "Günün haritasını göster" }).click();
    await expect(days.getByRole("button", { name: "Haritada gösteriliyor" })).toHaveCount(1);
  });

  test("desktop: place names in the carousel run up to three lines", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(plan());
    const name = page.locator("#yerler [role=list] button").first().locator("span.font-display").first();
    await expect(name).toBeVisible();
    await expect(name).toHaveCSS("-webkit-line-clamp", "3");
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(name).toHaveCSS("-webkit-line-clamp", "2");
  });
});
