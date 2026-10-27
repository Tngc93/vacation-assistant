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

test("Vienna: Schönbrunn, more than 5 km out, reads the same far-from-centre caption on its card, its details and its stop", async ({ page }) => {
  await page.goto(`/plan?to=VIE&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&cats=see`);
  const card = page.getByRole("list", { name: "Görülecek yerler" }).getByRole("button", { name: /Schönbrunn Sarayı/ });
  await expect(card).toContainText("MERKEZE UZAK · ~5 KM");
  await card.click();
  const details = page.locator("article", { has: page.getByRole("heading", { name: "Schönbrunn Sarayı" }) });
  await expect(details.getByText("MERKEZE UZAK · ~5 KM", { exact: true })).toBeVisible();
  await expect(details.getByText("TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR", { exact: true })).toBeVisible();
  const stop = page.locator("#gun-gun-plan li", { has: page.getByRole("button", { name: "Schönbrunn Sarayı durağını plandan çıkar" }) });
  await expect(stop.getByText("MERKEZE UZAK · ~5 KM", { exact: true })).toBeVisible();
});

test("Barcelona: Park Güell, 4 km out, is not called far from the centre", async ({ page }) => {
  await page.goto(`/plan?to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&cats=see`);
  const card = page.getByRole("list", { name: "Görülecek yerler" }).getByRole("button", { name: /Güell Parkı/ });
  await expect(card).toContainText(/MERKEZE [\d,]+ KM/);
  await expect(card).not.toContainText("MERKEZE UZAK");
});
