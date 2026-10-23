import { expect, test } from "./fixtures";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("a sight mapped as several OSM objects is listed once", async ({ page }) => {
  // OSM maps La Rambla as nine ways; the carousel shows it once.
  await page.goto(`/plan?from=IST&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2&cats=see`);
  const places = page.getByRole("list", { name: "Görülecek yerler" });
  await expect(places.getByRole("button").first()).toBeVisible();
  await expect(places.getByRole("button", { name: /^(MUTLAKA GÖR · \d\d )?La Rambla / })).toHaveCount(1);
});
