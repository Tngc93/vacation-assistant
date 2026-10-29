import { SITE_URL } from "../src/lib/brand";
import { expect, test } from "./fixtures";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const depart = isoDaysFromNow(30);
const ret = isoDaysFromNow(34);
const plan = `/plan?to=BCN&depart=${depart}&return=${ret}`;

const PAGES = [
  { name: "home", path: "/" },
  { name: "plan", path: plan },
  { name: "plan (no route)", path: "/plan" },
  { name: "styleguide", path: "/styleguide" },
  { name: "404", path: "/bu-sayfa-yok" },
];

for (const { name, path } of PAGES) {
  test(`${name}: the footer names the brand, the code, the data sources and the price caveat`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("Vacationist", { exact: true })).toBeVisible();
    await expect(footer.getByText("Kısa şehir kaçamakları için planlayıcı")).toBeVisible();
    await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/Tngc93/vacation-assistant");
    await expect(footer.getByRole("link", { name: "MIT lisansı" })).toHaveAttribute("href", /\/LICENSE$/);
    for (const source of ["OpenStreetMap", "Wikidata", "OurAirports", "GeoNames", "Wikimedia Commons", "Travelpayouts", "TCMB", "Frankfurter", "open.er-api", "passport-index-data"]) {
      await expect(footer.getByRole("link", { name: source, exact: true })).toBeVisible();
    }
    await expect(footer.getByText("Fiyatlar tahminidir; satın almadan önce sağlayıcıda doğrula.")).toBeVisible();
    await expect(
      footer.getByText("Ziyaretler çerezsiz ve anonim sayılır (Vercel Web Analytics); plan içeriğin ölçülmez."),
    ).toBeVisible();
    // The style guide is a tool: reachable, but not linked from the production header.
    await expect(page.getByRole("link", { name: "Stil rehberi" })).toHaveCount(0);
  });
}

test("a build outside the production deployment does not load Vercel Web Analytics", async ({ page }) => {
  const analytics: string[] = [];
  page.on("request", (request) => {
    if (/\/_vercel\/insights|vercel-scripts\.com/.test(request.url())) analytics.push(request.url());
  });
  await page.goto(plan);
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gün gün plan", exact: true })).toBeVisible();
  await expect(page.locator('script[src*="/_vercel/insights"]')).toHaveCount(0);
  expect(analytics).toEqual([]);
});

test("the footer is not printed", async ({ page }) => {
  await page.goto("/");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("contentinfo")).toBeHidden();
});

test("the style guide still opens, and asks not to be indexed", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("robots.txt lets crawlers in and points at the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toMatch(/^User-Agent: \*$/m);
  expect(body).toMatch(/^Allow: \/$/m);
  // /plan stays crawlable so link previews can read its Open Graph card; it says noindex itself.
  expect(body).not.toMatch(/Disallow/);
  expect(body.split("\n")).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test("the sitemap lists only the home page", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const locs = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs).toHaveLength(1);
  expect(locs[0]).toBe(SITE_URL);
});

test("the home page is indexable, a plan is not", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.goto(plan);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the home page's Open Graph card is a 1200×630 PNG", async ({ page, request }) => {
  await page.goto("/");
  const image = page.locator('meta[property="og:image"]');
  await expect(image).toHaveAttribute("content", new RegExp(`^${SITE_URL}/opengraph-image`));
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const { pathname, search } = new URL((await image.getAttribute("content"))!);
  const response = await request.get(pathname + search);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});

test("a plan's Open Graph card is drawn for its city and dates", async ({ page, request }) => {
  await page.goto(plan);
  const image = page.locator('meta[property="og:image"]');
  await expect(image).toHaveAttribute("content", new RegExp(`/og/plan\\?to=BCN&depart=${depart}&return=${ret}$`));
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /^Barselona · /);
  const { pathname, search } = new URL((await image.getAttribute("content"))!);
  for (const path of [pathname + search, "/og/plan", "/og/plan?to=XXX"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toBe("image/png");
  }
});

test("an unknown address shows the calm 404 with the way home", async ({ page }) => {
  const response = await page.goto("/bu-sayfa-yok");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Sayfa bulunamadı · Vacationist");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aradığın sayfa bu haritada yok.");
  await page.getByRole("link", { name: "Ana sayfaya dön" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Nereye gidiyorsun?" })).toBeVisible();
});
