import { expect, test } from "./fixtures";

// e2e server: VA_FLIGHTS_FIXTURES=1 (labelled sample flights), VA_RATES_FIXTURES=1 (the saved TCMB bulletin,
// named "ÖRNEK VERİ (TCMB)": EUR and USD, no GBP) and VA_OFFLINE=1.
function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const plan = `/plan?from=IST&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`;

test("a budget typed in the page opens the same from its link", async ({ page }) => {
  await page.goto(plan);
  const budget = page.locator("#butce");
  const receipt = budget.getByRole("region", { name: "Bütçe fişi" });
  await expect(receipt.getByText("KISMİ TOPLAM")).toBeVisible();

  await budget.getByLabel("Gecelik konaklama (tüm odalar)").fill("3000");
  await budget.getByLabel("Kişi başı günlük harcama").fill("1500,5");
  await expect(receipt.getByText("KISMİ TOPLAM")).toHaveCount(0);
  const total = await receipt.locator("[aria-live]").innerText();
  await expect(page).toHaveURL(/stay=3000&daily=1500\.5/);

  // Pick another ticket for the budget.
  await page.locator("#ucuslar").getByRole("button", { name: "Bütçeye ekle" }).first().click();
  await expect(page).toHaveURL(/flight=[A-Z]{3}-/);
  await expect(page.locator("#ucuslar").getByRole("button", { name: "Bütçede" })).toHaveCount(1);
  const withFlight = await receipt.locator("[aria-live]").innerText();
  expect(withFlight).not.toBe(total);
  await expect(budget.getByLabel("Gecelik konaklama (tüm odalar)")).toHaveValue("3000");

  // Open the shared link fresh.
  const link = page.url();
  const fresh = await page.context().newPage();
  await fresh.goto(link);
  const again = fresh.locator("#butce");
  await expect(again.getByLabel("Gecelik konaklama (tüm odalar)")).toHaveValue("3000");
  await expect(again.getByLabel("Kişi başı günlük harcama")).toHaveValue("1500,5");
  await expect(again.getByRole("region", { name: "Bütçe fişi" }).locator("[aria-live]")).toHaveText(withFlight);
  await expect(fresh.locator("#ucuslar").getByRole("button", { name: "Bütçede" })).toHaveCount(1);
});

test("choosing EUR shows the whole budget in euro, converts what was typed and keeps the link in step", async ({ page }) => {
  await page.goto(plan);
  const budget = page.locator("#butce");
  const receipt = budget.getByRole("region", { name: "Bütçe fişi" });
  const total = receipt.locator("[aria-live]");
  await expect(total).toHaveText(/₺/);
  await budget.getByLabel("Gecelik konaklama (tüm odalar)").fill("3000");
  await expect(page).toHaveURL(/stay=3000/);
  const inLira = await total.innerText();
  // The masthead rate line is in lira while the budget is.
  await expect(page.getByText(/^1 EUR = 55,62 ₺ · ÖRNEK VERİ \(TCMB\) · 16 Eki$/)).toBeVisible();

  await budget.getByRole("button", { name: "EUR" }).click();
  await expect(budget.getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
  await expect(receipt.getByText("BÜTÇE FİŞİ · EUR")).toBeVisible();
  await expect(total).not.toHaveText(inLira);
  await expect(total).toHaveText(/€/);
  // 3.000 ₺ ÷ 55,618 = 53,94 EUR, with the rate's source under the receipt.
  await expect(budget.getByLabel("Gecelik konaklama (tüm odalar)")).toHaveValue("53,94");
  await expect(receipt.getByText("Kur: ÖRNEK VERİ (TCMB) · 16 Eki")).toBeVisible();
  await expect(page).toHaveURL(/stay=53\.94&cur=EUR|cur=EUR.*stay=53\.94/);
  // Barcelona's currency is the budget's now: no rate line in the masthead.
  await expect(page.getByText(/^1 EUR = /)).toHaveCount(0);

  // Remembered: a plan opened without ?cur= is in euro, converting the link's lira amounts.
  const fresh = await page.context().newPage();
  await fresh.goto(`${plan}&stay=3000`);
  await expect(fresh.locator("#butce").getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
  await expect(fresh.locator("#butce").getByLabel("Gecelik konaklama (tüm odalar)")).toHaveValue("53,94");
  await expect(fresh).toHaveURL(/cur=EUR/);

  // USD: the masthead names the cross rate through lira.
  await budget.getByRole("button", { name: "USD" }).click();
  await expect(total).toHaveText(/\$/);
  await expect(page.getByText(/^1 EUR = 1,12 USD · ÖRNEK VERİ \(TCMB\) · 16 Eki$/)).toBeVisible();
});

test("a currency without a rate leaves the budget in lira and says so", async ({ page }) => {
  await page.goto(`${plan}&stay=120&cur=GBP`);
  const budget = page.locator("#butce");
  await expect(budget.getByRole("button", { name: "GBP" })).toHaveAttribute("aria-pressed", "true");
  await expect(budget.getByText("GBP kuru şu an alınamadı; bütçe TL olarak gösteriliyor.")).toBeVisible();
  await expect(budget.getByText("BÜTÇE FİŞİ · TL")).toBeVisible();
  // The pound amount is kept, out of the total, and the link is left as it was.
  await expect(budget.getByLabel("Gecelik konaklama (tüm odalar)")).toHaveValue("120");
  await expect(budget.getByText("kur alınamadı")).toBeVisible();
  await expect(budget.getByText("KISMİ TOPLAM")).toBeVisible();
  await expect(page).toHaveURL(/stay=120&cur=GBP/);
});
