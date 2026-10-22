import { expect, test, type Page } from "./fixtures";

// The home page asks only where and when; the origin and the number of people live on the plan page, in the
// stay and flight sections (2026-10-22). e2e server: VA_FLIGHTS_FIXTURES=1 (sample flights IST/SAW → BCN and
// ESB → AMS on nearby dates), VA_OFFLINE=1.

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
const route = (to: string) => `to=${to}&depart=${depart}&return=${ret}`;

/** The flights section's summary (each airport's cheapest ticket), once it has streamed in. */
async function cheapest(page: Page) {
  const list = page.locator("#ucuslar").getByRole("list", { name: "Havalimanı başına en ucuz bilet" });
  // Attached, not visible: a route without sample prices has an empty list.
  await expect(list).toBeAttached();
  return list;
}

test("the home page asks only where and when: no origin, no passengers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Nereye gidiyorsun?" })).toBeVisible();
  const form = page.locator("#arama");
  await expect(form.getByRole("combobox", { name: "Varış şehri" })).toBeVisible();
  await expect(form.getByRole("button", { name: /^Gidiş/ })).toBeVisible();
  await expect(form.getByRole("button", { name: /^Dönüş/ })).toBeVisible();
  await expect(form.getByRole("button", { name: "Planla" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("group", { name: /Kalkış|Nereden|Kişi|Yolcu/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /artır|azalt/ })).toHaveCount(0);
  await expect(page.getByText("Biniş kartı")).toHaveCount(0);
});

test("a discover city chip picks the city and opens the calendar; 'Planla' opens /plan with the city and dates only", async ({ page }) => {
  await page.goto("/");
  const discover = page.getByRole("list", { name: "Keşfet:" });
  await expect(discover.getByRole("button")).toHaveCount(6);
  await discover.getByRole("button", { name: "Barselona" }).click();
  await expect(page.getByRole("combobox", { name: "Varış şehri" })).toHaveValue("Barselona");
  const calendar = page.getByRole("dialog", { name: "Gidiş tarihini seç" });
  await expect(calendar).toBeVisible();

  // A day that can still be picked, then the return three days later.
  const day = calendar.locator("td[data-day]:not([data-disabled])").nth(2);
  const departIso = (await day.getAttribute("data-day"))!;
  await day.getByRole("button").click();
  const back = new Date(`${departIso}T00:00:00Z`);
  back.setUTCDate(back.getUTCDate() + 3);
  const returnIso = back.toISOString().slice(0, 10);
  await page.getByRole("dialog", { name: "Dönüş tarihini seç" }).locator(`td[data-day="${returnIso}"] button`).click();
  await page.getByRole("button", { name: "Planla" }).click();
  await expect(page).toHaveURL(new RegExp(`/plan\\?to=BCN&depart=${departIso}&return=${returnIso}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Barselona" })).toBeVisible();
});

test("a link without from and pax opens from İstanbul (IST + SAW) for one person", async ({ page }) => {
  await page.goto(`/plan?${route("BCN")}`);
  const list = await cheapest(page);
  await expect(list.getByText(/^IST · /)).toBeVisible();
  await expect(list.getByText(/^SAW · /)).toBeVisible();
  const flights = page.locator("#ucuslar");
  await expect(flights.getByRole("radio", { name: /İstanbul/ })).toBeChecked();
  await expect(flights.getByRole("group", { name: "Kişi sayısı" }).locator("output")).toHaveText("1 kişi");
  await expect(page.locator("#konaklama").getByRole("group", { name: "Kişi sayısı" }).locator("output")).toHaveText("1 kişi");
  await expect(page.locator("#konaklama").getByRole("link", { name: /Booking/ })).toHaveAttribute("href", /group_adults=1&/);
  // The masthead shows the dates and nights, not the people or the origin.
  const info = page.locator("#yerler").getByText(/→ .* · 4 GECE/);
  await expect(info).toBeVisible();
  await expect(info).not.toHaveText(/KİŞİ/);
});

test("an older link with from and pax opens the same plan", async ({ page }) => {
  await page.goto(`/plan?from=ESB&${route("AMS")}&pax=3`);
  const list = await cheapest(page);
  await expect(list.getByText(/^ESB · /)).toBeVisible();
  await expect(list.getByText(/^IST · /)).toHaveCount(0);
  await expect(page.locator("#ucuslar").getByRole("radio", { name: /Ankara/ })).toBeChecked();
  await expect(page.locator("#konaklama").getByRole("group", { name: "Kişi sayısı" }).locator("output")).toHaveText("3 kişi");
  await expect(page.locator("#konaklama").getByRole("link", { name: /Booking/ })).toHaveAttribute("href", /group_adults=3&/);
  // "Düzenle" goes home with the city and the dates filled in.
  await page.locator("#yerler").getByRole("link", { name: "Düzenle" }).click();
  await expect(page).toHaveURL(/\/\?from=ESB&to=AMS&depart=.*&pax=3#arama$/);
  await expect(page.getByRole("combobox", { name: "Varış şehri" })).toHaveValue("Amsterdam");
});

test("Ankara in the flights section moves the URL and the results to ESB, keeping the other params", async ({ page }) => {
  await page.goto(`/plan?${route("AMS")}&cats=see%2Cmuseum&skip=n1&stay=3000&daily=150`);
  const list = await cheapest(page);
  // IST → AMS has no sample prices; ESB → AMS has them on nearby dates.
  await expect(page.locator("#ucuslar").getByText("Bu tarihler ve ±3 gün için önbellekte fiyat yok.").first()).toBeVisible();
  const scrolled = await page.locator("#ucuslar").evaluate((el) => {
    el.scrollIntoView();
    return Math.round(window.scrollY);
  });

  await page.locator("#ucuslar").getByText("Ankara", { exact: true }).click();
  await expect(page).toHaveURL(/[?&]from=ESB(&|$)/);
  await expect(list.getByText(/^ESB · /)).toBeVisible();
  await expect(list.getByText(/FARKLI TARİH/)).toBeVisible();
  const url = new URL(page.url());
  expect(Object.fromEntries(url.searchParams)).toEqual({
    to: "AMS",
    depart,
    return: ret,
    cats: "see,museum",
    skip: "n1",
    stay: "3000",
    daily: "150",
    from: "ESB",
  });
  // The page stays where it was.
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolled)).toBeLessThan(80);
  await expect(page.locator("#butce").getByLabel("Gecelik konaklama (tüm odalar)")).toHaveValue("3000");
});

test("the number of people changes the budget total and the Booking link", async ({ page }) => {
  await page.goto(`/plan?${route("BCN")}&daily=100`);
  const receipt = page.locator("#butce").getByRole("region", { name: "Bütçe fişi" });
  const total = receipt.locator("[aria-live]");
  await expect(total).toHaveText(/₺/);
  const before = await total.innerText();
  const stays = page.locator("#konaklama");
  await expect(stays.getByRole("link", { name: /Booking/ })).toHaveAttribute("href", /group_adults=1&/);

  await stays.getByRole("button", { name: "Kişi artır" }).click();
  await expect(page).toHaveURL(/[?&]pax=2(&|$)/);
  await expect(stays.getByRole("link", { name: /Booking/ })).toHaveAttribute("href", /group_adults=2&/);
  await expect(page.locator("#ucuslar").getByRole("group", { name: "Kişi sayısı" }).locator("output")).toHaveText("2 kişi");
  await expect(total).not.toHaveText(before);
  await expect(page.locator("#butce").getByText("5 gün × 2 kişi", { exact: false }).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("daily")).toBe("100");
});

test("a new origin takes the chosen flight out of the budget and says so, until another flight is chosen", async ({ page }) => {
  await page.goto(`/plan?${route("BCN")}`);
  const flights = page.locator("#ucuslar");
  const list = await cheapest(page);
  await list.getByRole("button", { name: "Bütçeye ekle" }).first().click();
  await expect(page).toHaveURL(/[?&]flight=/);
  const note = page.locator("#butce").getByText("Kalkış değişti; seçili uçuş bütçeden çıkarıldı.");
  await expect(note).toHaveCount(0);

  await flights.getByText("Ankara", { exact: true }).click();
  await expect(page).toHaveURL(/[?&]from=ESB(&|$)/);
  await expect(page).not.toHaveURL(/[?&]flight=/);
  await expect(note).toBeVisible();

  // Back to İstanbul and a ticket chosen again: the note goes.
  await flights.getByText("İstanbul", { exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]from=/);
  await expect(list.getByRole("button", { name: "Bütçeye ekle" }).first()).toBeVisible();
  await list.getByRole("button", { name: "Bütçeye ekle" }).first().click();
  await expect(page).toHaveURL(/[?&]flight=/);
  await expect(note).toHaveCount(0);
});
