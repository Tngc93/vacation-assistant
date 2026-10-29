import { expect, test, type Page } from "./fixtures";

// The whole flow once, as a visitor walks it: home → plan → AI tab → stays → flights → budget. Nothing may throw
// or log an error, and every link back into the site must resolve. e2e server: VA_OFFLINE=1 (external sources
// fail fast), VA_FLIGHTS_FIXTURES=1 (sample IST/SAW → BCN flights around the 14th).

// Trips start on the 14th of a month at least ten days ahead, so the samples' nearby dates are in the future.
function tripDates(): { depart: string; ret: string } {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 10);
  if (date.getUTCDate() > 14) date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(14);
  const depart = date.toISOString().slice(0, 10);
  return { depart, ret: `${depart.slice(0, 8)}18` };
}
const { depart, ret } = tripDates();

/** Errors the page itself raises; a resource the offline server or the image fixture refuses is not one. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/^Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

test("home → plan → AI tab → stays → flights → budget: no errors, and every internal link resolves", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Nereye gidiyorsun?" })).toBeVisible();

  await page.goto(`/?to=BCN&depart=${depart}&return=${ret}`);
  await page.getByRole("button", { name: "Planla" }).click();
  await expect(page).toHaveURL(new RegExp(`/plan\\?to=BCN&depart=${depart}&return=${ret}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Barselona" })).toBeVisible();

  const plan = page.locator("#gun-gun-plan");
  await expect(plan.getByRole("region", { name: /^1\. gün · / })).toBeVisible();
  await plan.getByRole("button", { name: /^Yapay zekâ ile planla/ }).click();
  await expect(page.locator("main #yapay-zeka-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("main #yapay-zeka-panel")).toBeHidden();

  await page.locator("#konaklama").scrollIntoViewIfNeeded();
  await expect(page.locator("#konaklama").getByRole("link", { name: /Booking/ })).toBeVisible();
  const flights = page.locator("#ucuslar");
  await flights.scrollIntoViewIfNeeded();
  await expect(flights.getByRole("list", { name: "Havalimanı başına en ucuz bilet" })).toBeVisible();
  await flights.getByRole("button", { name: "Bütçeye ekle" }).first().click();
  await expect(page).toHaveURL(/[?&]flight=/);
  await page.locator("#butce").scrollIntoViewIfNeeded();
  await expect(page.locator("#butce")).toBeVisible();

  const internal = await page.$$eval("a[href]", (links) =>
    [...new Set(links.map((a) => (a as HTMLAnchorElement).href).filter((href) => href.startsWith(location.origin)))],
  );
  expect(internal.length).toBeGreaterThan(0);
  for (const href of internal) {
    const response = await page.request.get(href);
    expect(response.status(), href).toBeLessThan(400);
  }
  expect(errors).toEqual([]);
});
