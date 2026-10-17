import { expect, test } from "@playwright/test";

// e2e server: VA_FLIGHTS_FIXTURES=1 (labelled sample flights) and VA_OFFLINE=1 (no exchange rates).
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

test("local-currency amounts say when there is no rate and stay out of the total", async ({ page }) => {
  await page.goto(`${plan}&stay=120&cur=EUR`);
  const budget = page.locator("#butce");
  await expect(budget.getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
  await expect(budget.getByText(/EUR kuru şu an alınamıyor/)).toBeVisible();
  await expect(budget.getByText("kur alınamadı")).toBeVisible();
  await expect(budget.getByText("KISMİ TOPLAM")).toBeVisible();
});
