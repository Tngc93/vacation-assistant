import { AI_ORIGINS } from "../src/lib/ai/origins";
import { expect, test, type Page } from "./fixtures";

// The only spec with the service worker on (playwright.config.ts blocks it elsewhere). Its own requests to
// Commons and the map tiles are not seen by page.route, so they fail here, at the context.
test.use({ serviceWorkers: "allow" });
test.beforeEach(async ({ context }) => {
  await context.route(/^https:\/\/((upload|thumb)\.wikimedia\.org|tiles\.openfreemap\.org)\//, (route) => route.abort());
});

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const dates = `depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
const PLAN = `/plan?to=BCN&${dates}`;
const UNOPENED_PLAN = `/plan?to=PAR&${dates}`;

/** Waits until the worker is active and controls the page. */
async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toContain("/sw.js?v=");
}

/** Every URL in every cache the site keeps. */
function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
}

test("each language links its own manifest, registers the worker and is installable", async ({ page, request }) => {
  for (const [path, manifest, start] of [
    ["/", "/manifest.webmanifest", "/"],
    ["/en", "/en/manifest.webmanifest", "/en"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", manifest);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/icons\/apple-touch-icon\.png/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
    await controlled(page);

    const json = await (await request.get(manifest)).json();
    expect(json).toMatchObject({ start_url: start, scope: "/", display: "standalone", name: "Vacationist" });

    // Chrome's own install check: the manifest, its icons and the page.
    const cdp = await page.context().newCDPSession(page);
    const { errors } = await cdp.send("Page.getAppManifest");
    expect(errors).toEqual([]);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    expect(installabilityErrors).toEqual([]);
    await cdp.detach();
  }
});

test("a plan opened online opens again offline, under the offline strip", async ({ page, context }) => {
  await page.goto(PLAN);
  await expect(page.getByRole("heading", { name: "Gün gün plan", exact: true })).toBeVisible();
  await controlled(page);
  // Opened before the worker controlled the page, the plan is saved once it does.
  await expect.poll(() => cachedUrls(page)).toContain(new URL(PLAN, page.url()).href);
  await expect(page.getByRole("status").filter({ hasText: "Çevrimdışısın" })).toHaveCount(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Çevrimdışısın; bu plan son açtığın hâliyle gösteriliyor." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gün gün plan", exact: true })).toBeVisible();
  await expect(page.locator("#ucuslar").getByText("Çevrimdışı · fiyatlar güncel değil")).toBeVisible();

  // A plan never opened: the calm offline page, with the saved plan to go to instead.
  await page.goto(UNOPENED_PLAN);
  await expect(page).toHaveURL(/\/offline\?from=/);
  await expect(page.getByRole("heading", { name: "Bu sayfa çevrimdışı açılamıyor." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yeniden dene" })).toBeVisible();
  const saved = page.getByRole("region", { name: "Bu cihazda kayıtlı planlar" });
  await saved.getByRole("link", { name: /Barselona/ }).click();
  await expect(page).toHaveURL(PLAN);
  await expect(page.getByRole("heading", { name: "Gün gün plan", exact: true })).toBeVisible();
  await context.setOffline(false);
});

test("an unopened English page offline shows the English offline page", async ({ page, context }) => {
  await page.goto("/en");
  await controlled(page);
  await context.setOffline(true);
  await page.goto(`/en${UNOPENED_PLAN}`);
  await expect(page).toHaveURL(/\/en\/offline\?from=/);
  await expect(page.getByRole("heading", { name: "This page cannot open offline." })).toBeVisible();
  // The start page itself was saved at install.
  await page.goto("/en");
  await expect(page.getByRole("status").filter({ hasText: "You are offline" })).toBeVisible();
  await context.setOffline(false);
});

test("the API and the AI providers pass the worker by and are never cached", async ({ page, context }) => {
  const viaWorker: string[] = [];
  page.on("response", (response) => {
    if (response.fromServiceWorker()) viaWorker.push(response.url());
  });
  await context.route(new RegExp(`^(${Object.values(AI_ORIGINS).join("|").replace(/\./g, "\\.")})/`), (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }),
  );
  await page.goto(PLAN);
  await controlled(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Gün gün plan", exact: true })).toBeVisible();

  const statuses = await page.evaluate(
    async (origins) =>
      Promise.all(
        ["/api/origins?q=ist", ...origins.map((origin) => `${origin}/v1/models`)].map((url) =>
          fetch(url).then((r) => r.status, () => 0),
        ),
      ),
    Object.values(AI_ORIGINS),
  );
  expect(statuses).toEqual([200, 200, 200, 200]);

  const urls = await cachedUrls(page);
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.filter((url) => /\/api\/|\/_vercel\//.test(url))).toEqual([]);
  for (const origin of Object.values(AI_ORIGINS)) expect(urls.filter((url) => url.startsWith(origin))).toEqual([]);
  // The plan itself came through the worker; the API and the providers did not.
  expect(viaWorker.some((url) => url.includes("/plan?"))).toBe(true);
  expect(viaWorker.filter((url) => url.includes("/api/") || Object.values(AI_ORIGINS).some((o) => url.startsWith(o)))).toEqual([]);
});

test("a new version is offered quietly and loads only when asked", async ({ page }) => {
  await page.goto("/");
  await controlled(page);
  await page.evaluate(() => Object.assign(window, { notReloaded: true }));
  // A new build registers a new worker URL; this one stands in for the next deploy.
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js?v=e2e-next").then(() => undefined));

  const notice = page.getByRole("status").filter({ hasText: "Yeni sürüm hazır" });
  await expect(notice).toBeVisible();
  expect(await page.evaluate(() => "notReloaded" in window)).toBe(true);

  const reloaded = page.waitForEvent("load");
  await notice.getByRole("button", { name: "Yenile" }).click();
  await reloaded;
  expect(await page.evaluate(() => "notReloaded" in window)).toBe(false);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toContain("v=e2e-next");
});

test("the footer says how to add the app to a phone", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByText("Uygulamayı telefona ekle").click();
  await expect(footer.getByText("iPhone ve iPad (Safari): Paylaş → Ana Ekrana Ekle")).toBeVisible();
  await expect(footer.getByText("Android ve Chrome: menü (⋮) → Uygulamayı yükle")).toBeVisible();

  await page.goto("/en");
  await page.getByRole("contentinfo").getByText("Add the app to your phone").click();
  await expect(page.getByText("iPhone and iPad (Safari): Share → Add to Home Screen")).toBeVisible();
});
