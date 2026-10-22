import { expect, test } from "./fixtures";

// The interface says "Vacationist"; the old working name lives on only in URLs, ids and the data User-Agent ("vacation-assistant", "VacationAssistant").
const OLD_NAME = /vacation\s+assistant/i;
const TAGLINE = "Kısa şehir kaçamakları için planlayıcı";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const PAGES = [
  { name: "home", path: "/", title: "Vacationist" },
  {
    name: "plan (valid link)",
    path: `/plan?from=IST&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`,
    title: /→ Barselona · .* · Vacationist$/,
  },
  { name: "plan (no route)", path: "/plan", title: "Plan · Vacationist" },
  { name: "styleguide", path: "/styleguide", title: "Stil rehberi · Vacationist" },
];

for (const { name, path, title } of PAGES) {
  test(`${name}: the brand is Vacationist in the page, its metadata and the streamed payload`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("banner").getByRole("link", { name: "Vacationist", exact: true })).toBeVisible();
    // Wait for every streamed section, so the whole document is checked.
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Vacationist");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    if (path === "/") {
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", new RegExp(`^${TAGLINE}`));
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", "Vacationist");
      await expect(page.locator('meta[name="application-name"]')).toHaveAttribute("content", "Vacationist");
    }

    // Visible text, attributes (aria-label, alt, meta content) and the RSC payload in one go.
    expect(await page.content()).not.toMatch(OLD_NAME);
  });
}

test("the web manifest names Vacationist", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Vacationist", short_name: "Vacationist", lang: "tr" });
  expect(manifest.description).toContain(TAGLINE);
  expect(JSON.stringify(manifest)).not.toMatch(OLD_NAME);
});
