import { expect, test } from "@playwright/test";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("a sight mapped as several OSM objects is listed once", async ({ page }) => {
  // OSM maps La Rambla as nine ways; the guide shows it once.
  await page.goto(`/plan?from=IST&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2&cats=see`);
  const sights = page.getByRole("region", { name: "Görülecek yer" });
  await expect(sights.getByRole("heading", { level: 4 }).first()).toBeVisible();
  await expect(sights.getByRole("heading", { level: 4, name: "La Rambla", exact: true })).toHaveCount(1);
});
