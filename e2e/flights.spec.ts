import { expect, test, type Page } from "@playwright/test";

// The e2e server runs with VA_FLIGHTS_FIXTURES=1: labelled sample prices, no token, no network.
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

/** The full list sits behind "Tüm uçuşları gör", closed by default; returns the opened list. */
async function openAllFlights(page: Page) {
  await page.locator("#ucuslar").getByText("Tüm uçuşları gör").click();
  return page.locator("#ucuslar details").first();
}

test("Istanbul flights are grouped by IST and SAW, with a non-stop filter in the URL", async ({ page }) => {
  await page.goto(`/plan?from=IST&to=BCN&depart=${depart}&return=${ret}&pax=2`);
  // The summary: each airport's cheapest ticket, the overall cheapest marked; the list is closed.
  const summary = page.locator("#ucuslar");
  await expect(summary.getByText(/ÖRNEK VERİ/).first()).toBeVisible();
  await expect(summary.getByText("EN UCUZ · 1 YETİŞKİN")).toHaveCount(1);
  await expect(summary.getByRole("link", { name: /Güncel fiyatı gör/ })).toHaveCount(2);
  await expect(summary.getByRole("heading", { name: "İstanbul Havalimanı" })).toBeHidden();
  await expect(summary.getByRole("button", { name: "Aktarmasız" })).toBeHidden();

  const flights = await openAllFlights(page);
  await expect(flights.getByRole("heading", { name: "İstanbul Havalimanı" })).toBeVisible();
  await expect(flights.getByRole("heading", { name: "Sabiha Gökçen" })).toBeVisible();
  await expect(flights.getByText("EN UCUZ", { exact: true })).toHaveCount(1);
  await expect(flights.getByText("1 AKTARMA").first()).toBeVisible();

  await flights.getByRole("button", { name: "Aktarmasız" }).click();
  await expect(page).toHaveURL(/direct=1/);
  await expect(flights.getByRole("button", { name: "Aktarmasız" })).toHaveAttribute("aria-pressed", "true");
  await expect(flights.getByText("1 AKTARMA")).toHaveCount(0);
});

test("Ankara flights fall back to nearby dates, each labelled as a different date", async ({ page }) => {
  await page.goto(`/plan?from=ESB&to=AMS&depart=${depart}&return=${ret}&pax=1`);
  const flights = await openAllFlights(page);
  await expect(flights.getByText(/Seçtiğin tarihler için önbellekte fiyat yok/)).toBeVisible();
  const cards = flights.getByRole("article");
  await expect(cards).toHaveCount(3);
  await expect(flights.getByText("FARKLI TARİH · seçtiğin tarihler değil")).toHaveCount(3);
  await expect(flights.getByText("EN UCUZ", { exact: true })).toHaveCount(0);
});

test("the loading placeholder is gone once the cards arrive, and other returns open", async ({ page }) => {
  await page.goto(`/plan?from=IST&to=BCN&depart=${depart}&return=${ret}&pax=2`);
  const flights = await openAllFlights(page);
  await expect(flights.getByRole("article").first()).toBeVisible();
  // The Suspense fallback ("Uçuşlar yükleniyor") is replaced, not left on screen or in the accessibility tree.
  await expect(flights.getByRole("status")).toHaveCount(0);
  await expect(page.getByText("Uçuşlar yükleniyor")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain("Uçuşlar yükleniyor");

  await expect(flights.getByText(/^Lufthansa ·/)).toHaveCount(1);
  await flights.getByText("Diğer dönüş saatleri (1)").click();
  await expect(flights.locator("details[open]").getByText("6.150 ₺")).toBeVisible();
});
