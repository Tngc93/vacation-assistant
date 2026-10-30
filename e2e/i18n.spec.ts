import { expect, test, type Page } from "./fixtures";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const trip = `to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
const SECTIONS = ["yerler", "gun-gun-plan", "konaklama", "ucuslar", "butce"] as const;

/** The whole plan streamed in: every section in place and no loading placeholder left. */
async function planReady(page: Page, day: RegExp) {
  for (const id of SECTIONS) await expect(page.locator(`main section#${id}`)).toBeVisible();
  await expect(page.locator("#gun-gun-plan").getByRole("region", { name: day })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Letters only Turkish uses (ı, İ, ğ, ş): none may be left on an English page. */
const TURKISH_ONLY = /[ıİğĞşŞ]/;

test("every section of /en/plan is in English, with English names and the EUR budget", async ({ page }) => {
  await page.goto(`/en/plan?${trip}&pax=2`);
  await planReady(page, /^Day 1 · /);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(/^Istanbul → Barcelona · .* · 2 people · Vacationist$/);
  for (const [id, title] of [
    ["gun-gun-plan", "Day-by-day plan"],
    ["konaklama", "Stays"],
    ["ucuslar", "Flights"],
    ["butce", "Budget"],
  ]) {
    await expect(page.locator(`#${id}`).getByRole("heading", { level: 2 })).toHaveText(title);
  }
  // English names: Wikipedia's title "Sagrada Família" (not Wikidata's long label), "Park Güell" (not "Güell Parkı").
  await expect(page.getByRole("list", { name: "Sights" })).toContainText("Sagrada Família");
  await expect(page.getByRole("list", { name: "Sights" })).toContainText("Park Güell");
  // The budget defaults to EUR in English.
  await expect(page.locator("#butce").getByText(/^BUDGET RECEIPT · EUR$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan with AI" }).first()).toBeVisible();

  const text = await page.locator("body").innerText();
  const turkish = text.split("\n").filter((line) => TURKISH_ONLY.test(line));
  expect(turkish, "lines with Turkish letters").toEqual([]);
  // Opened parts are English too: all flights, the hours of a place, the AI panel.
  await page.getByRole("button", { name: "See all flights" }).click();
  await page.locator("#gun-gun-plan").getByRole("button", { name: "Plan with AI" }).click();
  await expect(page.locator("#yapay-zeka-panel")).toBeVisible();
  const opened = (await page.locator("main").innerText()).split("\n").filter((line) => TURKISH_ONLY.test(line));
  expect(opened, "lines with Turkish letters").toEqual([]);
});

test("the TR / EN switch opens the same plan in the other language with every parameter", async ({ page }) => {
  const query = `from=LON&${trip}&pax=2&cur=USD&stay=120&skip=n1`;
  await page.goto(`/plan?${query}`);
  await planReady(page, /^1\. gün · /);
  await page.getByRole("link", { name: /^EN/ }).click();
  await page.waitForURL("**/en/plan?**");
  expect(new URL(page.url()).search).toBe(`?${query}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await planReady(page, /^Day 1 · /);
  // The link's ?cur= wins over the English default.
  await expect(page.locator("#butce").getByText(/^BUDGET RECEIPT · USD$/)).toBeVisible();
  await page.getByRole("link", { name: /^TR/ }).click();
  await page.waitForURL((url) => url.pathname === "/plan");
  expect(new URL(page.url()).search).toBe(`?${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Barselona" })).toBeVisible();
});

test("the language's default currency stays out of the link; a picked one is written and kept across the switch", async ({ page }) => {
  await page.goto(`/en/plan?${trip}`);
  await planReady(page, /^Day 1 · /);
  await expect(page.locator("#butce").getByText(/^BUDGET RECEIPT · EUR$/)).toBeVisible();
  expect(new URL(page.url()).searchParams.has("cur")).toBe(false);
  // To Turkish: no ?cur=, so the Turkish default.
  await page.getByRole("link", { name: /^TR/ }).click();
  await page.waitForURL((url) => url.pathname === "/plan");
  await expect(page.locator("#butce").getByText(/^BÜTÇE FİŞİ · TL$/)).toBeVisible();
  expect(new URL(page.url()).searchParams.has("cur")).toBe(false);
  // Back in English, USD picked: written, and kept in Turkish.
  await page.getByRole("link", { name: /^EN/ }).click();
  await page.waitForURL("**/en/plan?**");
  await page.locator("#butce").getByRole("button", { name: "USD" }).click();
  await expect(page).toHaveURL(/[?&]cur=USD/);
  await page.getByRole("link", { name: /^TR/ }).click();
  await page.waitForURL((url) => url.pathname === "/plan");
  expect(new URL(page.url()).searchParams.get("cur")).toBe("USD");
  await expect(page.locator("#butce").getByText(/^BÜTÇE FİŞİ · USD$/)).toBeVisible();
});

test("there is no automatic language redirect: an English browser gets Turkish at the root", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB", extraHTTPHeaders: { "Accept-Language": "en-GB,en;q=0.9" } });
  const page = await context.newPage();
  const response = await page.goto("/");
  expect(response?.url()).toMatch(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Nereye gidiyorsun?" })).toBeVisible();
  await context.close();
});

test("hreflang, canonical, the sitemap and the English Open Graph card", async ({ page, request }) => {
  await page.goto("/en");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
  await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveAttribute("href", /vercel\.app\/?$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en$/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_GB");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://vacationist-app.vercel.app/en</loc>");
  expect(sitemap).toContain('hreflang="tr"');
  await page.goto(`/en/plan?${trip}`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\/plan\?.*lang=en/);
  const card = await request.get(`/og/plan?${trip}&lang=en`);
  expect(card.headers()["content-type"]).toContain("image/png");
});

test("an unknown English address gets the English 404 inside the site's frame", async ({ page }) => {
  const response = await page.goto("/en/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "The page you are looking for is not on this map." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the home page" })).toHaveAttribute("href", "/en");
});
