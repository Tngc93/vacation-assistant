import { expect, test, type Page } from "./fixtures";

// e2e server: pre-fetched place files, no network.
function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const trip = `depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
const card = (page: Page, name: string) =>
  page.getByRole("list", { name: "Görülecek yerler" }).getByRole("listitem").filter({ hasText: name }).first();
const details = (page: Page, name: string) => page.locator("article", { has: page.getByRole("heading", { name }) });

test("Moscow: the Kremlin is 'Moskova Kremlini', and the Tsar Bell's card says it is inside it", async ({ page }) => {
  await page.goto(`/plan?to=MOW&${trip}`);
  await expect(card(page, "Çar Çanı")).toContainText("MOSKOVA KREMLİNİ İÇİNDE");
  await card(page, "Moskova Kremlini").getByRole("button").click();
  await expect(details(page, "Moskova Kremlini").getByText("Московский Кремль")).toBeVisible();
});

test("Sofia: a museum with no Latin name anywhere is romanized by Bulgaria's system, the original under it", async ({ page }) => {
  await page.goto(`/plan?to=SOF&${trip}`);
  const name = "Muzey po paleontologia i istorichna geologia";
  await card(page, name).getByRole("button").click();
  await expect(details(page, name).getByText("Музей по палеонтология и исторична геология")).toBeVisible();
});
