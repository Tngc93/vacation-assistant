import { expect, test } from "./fixtures";

/** `?depart=&return=` for the next `month`/`from`–`to` at least 7 days ahead (trips can be planned 12 months out). */
function dates(month: number, from: number, to: number): string {
  const now = new Date();
  const soon = now.getTime() + 7 * 86_400_000;
  const year = Date.UTC(now.getUTCFullYear(), month - 1, from) >= soon ? now.getUTCFullYear() : now.getUTCFullYear() + 1;
  const iso = (day: number) => new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  return `depart=${iso(from)}&return=${iso(to)}`;
}

const chips = (page: import("./fixtures").Page) => page.getByRole("group", { name: "Mekân kategorileri" });

test("Munich in late September: the Etkinlik chip and Oktoberfest first in the carousel, with honest dates", async ({ page }) => {
  await page.goto(`/plan?to=MUC&${dates(9, 22, 26)}`);
  await expect(chips(page).getByRole("button", { name: "Etkinlik" })).toHaveAttribute("aria-pressed", "true");
  const first = page.getByRole("list", { name: "Görülecek yerler" }).getByRole("listitem").first();
  await expect(first).toContainText("Oktoberfest");
  // Wikidata has only Oktoberfest's months (no edition with day-precise dates): "usually", never a guessed date.
  await expect(first).toContainText(/GENELDE EYLÜL–EKİM · TARİHİ DOĞRULA|\d+ EYL – \d+ EKİ/);

  await first.getByRole("button").click();
  const details = page.locator("article", { has: page.getByRole("heading", { name: "Oktoberfest" }) });
  await expect(details.getByText("Tarihleri resmî kaynaktan doğrula")).toBeVisible();
  await expect(details.getByText(/Kaynak: Wikidata/)).toBeVisible();
  await expect(details.getByRole("link", { name: /Resmî site/ })).toHaveAttribute("href", /oktoberfest\.de/);

  // The chip turns the events off, in the URL.
  await chips(page).getByRole("button", { name: "Etkinlik" }).click();
  await expect(page).toHaveURL(/cats=see%2Cmuseum%2Crestaurant(&|$)/);
  await expect(page.getByRole("list", { name: "Görülecek yerler" }).getByRole("listitem").first()).not.toContainText("Oktoberfest");
});

test("Munich in spring: no event falls in the dates, so there is no Etkinlik chip", async ({ page }) => {
  await page.goto(`/plan?to=MUC&${dates(4, 14, 17)}`);
  await expect(chips(page).getByRole("button", { name: "Görülecek yer" })).toBeVisible();
  await expect(chips(page).getByRole("button", { name: "Etkinlik" })).toHaveCount(0);
  await expect(page.getByText(/^BU TARİHLERDE:/)).toHaveCount(0);
});
