import { expect, test, type Page } from "@playwright/test";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const plan = `/plan?from=IST&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`;

const cards = (page: Page) => page.getByRole("list", { name: "Görülecek yerler" }).getByRole("button");
const map = (page: Page) => page.getByRole("region", { name: "Mekân haritası" });

async function bottomWithin(page: Page, locator: ReturnType<Page["locator"]>, height: number) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "on screen").not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height);
}

for (const [width, height] of [
  [1280, 720],
  [1440, 900],
  [1512, 982],
] as const) {
  test(`at ${width}×${height} the hero fits without scrolling: title, chips, three cards and the map`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(plan);
    const hero = page.locator("#yerler");
    await bottomWithin(page, hero.getByRole("heading", { level: 1, name: "Barselona" }), height);
    await bottomWithin(page, hero.getByRole("group", { name: "Mekân kategorileri" }), height);
    for (let i = 0; i < 3; i++) await bottomWithin(page, cards(page).nth(i), height);
    // The cards are side by side: the third ends inside the carousel, the fourth does not.
    const list = await page.getByRole("list", { name: "Görülecek yerler" }).boundingBox();
    const third = await cards(page).nth(2).boundingBox();
    expect(third!.x + third!.width).toBeLessThanOrEqual(list!.x + list!.width + 1);
    await bottomWithin(page, map(page), height);
    await bottomWithin(page, hero, height);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test("the carousel moves with its arrows and the keyboard, and keeps count", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(plan);
  const counter = page.locator("#yerler").getByText(/^\d\d \/ \d\d+$/);
  await expect(counter).toHaveText(/^01 \/ /);
  await expect(page.getByRole("button", { name: "Önceki yer" })).toBeDisabled();
  await page.getByRole("button", { name: "Sonraki yer" }).click();
  await expect(counter).toHaveText(/^02 \/ /);
  await page.getByRole("button", { name: "Önceki yer" }).click();
  await expect(counter).toHaveText(/^01 \/ /);

  await cards(page).first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(cards(page).nth(1)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(cards(page).nth(3)).toBeFocused();
  await expect(counter).not.toHaveText(/^01 \/ /);
});

test("a chip filters the carousel and the map together, in the URL", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(plan);
  await expect(map(page)).toHaveAttribute("data-places", /^\d+$/);
  const before = Number(await map(page).getAttribute("data-places"));
  const total = (await page.locator("#yerler").getByText(/^\d\d \/ \d\d+$/).innerText()).split(" / ")[1];
  expect(Number(total)).toBe(before);

  await page.getByRole("button", { name: "Restoran", exact: true }).click();
  await expect(page).toHaveURL(/cats=see%2Cmuseum/);
  await expect(map(page)).not.toHaveAttribute("data-places", String(before));
  const after = Number(await map(page).getAttribute("data-places"));
  await expect(page.locator("#yerler").getByText(/^\d\d \/ \d\d+$/)).toHaveText(new RegExp(`/ ${String(after).padStart(2, "0")}$`));
  expect(after).toBeLessThan(before);
});

test("a card lights up its dot on hover, and selecting it marks it on the map with its details", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(plan);
  const first = cards(page).first();
  await first.hover();
  await expect(map(page)).not.toHaveAttribute("data-active", "");
  const lit = await map(page).getAttribute("data-active");
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(map(page)).toHaveAttribute("data-selected", lit!);
  await expect(page.getByRole("button", { name: "Ayrıntıyı kapat" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Google Haritalar'da aç/ })).toBeVisible();
});

test("at 375px there is no sideways page scroll, and the map strip opens full screen and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(plan);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  // One card at a time, with the next card's edge showing.
  const first = await cards(page).first().boundingBox();
  const second = await cards(page).nth(1).boundingBox();
  expect(first!.width).toBeGreaterThan(250);
  expect(second!.x).toBeLessThan(375);

  const open = page.getByRole("button", { name: /Haritayı aç/ });
  await open.scrollIntoViewIfNeeded();
  const strip = await open.boundingBox();
  expect(Math.round(strip!.height)).toBe(180);
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Harita" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBe(375);
  expect(box!.height).toBe(812);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("the plan page has no visa section; the sections follow the hero in order with a sticky menu", async ({ page }) => {
  await page.goto(plan);
  await expect(page.locator("#vize")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Vize" })).toHaveCount(0);
  await expect(page.getByText(/VİZESİZ|VİZE GEREKLİ/)).toHaveCount(0);
  const order = await page.locator("main section[id]").evaluateAll((els) => els.map((e) => e.id).filter((id) => ["yerler", "gun-gun-plan", "butce", "bilet-ve-konaklama"].includes(id)));
  expect(order).toEqual(["yerler", "gun-gun-plan", "butce", "bilet-ve-konaklama"]);
  await expect(page.getByText("İstersen buradan da bakabilirsin.")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Plan bölümleri" });
  await expect(nav.getByRole("link")).toHaveText(["Yerler", "Plan", "Bütçe", "Bilet ve konaklama"]);
  await nav.getByRole("link", { name: "Bütçe" }).click();
  await expect(nav.getByRole("link", { name: "Bütçe" })).toHaveAttribute("aria-current", "location");
  const top = await nav.boundingBox();
  expect(Math.round(top!.y)).toBe(0);
});

test("'Tüm uçuşları gör' is closed by default and opens the list and its filter under both cards, at full width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(plan);
  const toggle = page.locator("#ucuslar").getByRole("button", { name: "Tüm uçuşları gör" });
  const all = page.locator("#tum-ucuslar");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(all).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(all.getByRole("button", { name: "Aktarmasız" })).toBeVisible();
  await expect(all.getByRole("article").first()).toBeVisible();

  // Under both cards, as wide as the section.
  const section = await page.locator("#bilet-ve-konaklama").boundingBox();
  const list = await all.boundingBox();
  const cards = await page.locator("#konaklama").boundingBox();
  expect(Math.abs(list!.width - section!.width)).toBeLessThanOrEqual(1);
  expect(list!.y).toBeGreaterThan(cards!.y + cards!.height);
});

for (const width of [1280, 1440]) {
  test(`at ${width}px no time or duration on the flight tickets wraps`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(plan);
    await page.locator("#ucuslar").getByRole("button", { name: "Tüm uçuşları gör" }).click();
    const tickets = page.locator("#tum-ucuslar article");
    await expect(tickets.first()).toBeVisible();
    // Each leg's time line and its stops/duration caption sit on one line.
    const wrapped = await tickets.evaluateAll((articles) =>
      articles.flatMap((article) =>
        [...article.querySelectorAll("p.font-mono, p.uppercase")]
          .filter((p) => /\d{2}:\d{2}|SA \d|DK/.test(p.textContent ?? ""))
          .filter((p) => p.getBoundingClientRect().height > parseFloat(getComputedStyle(p).lineHeight) * 1.5)
          .map((p) => p.textContent),
      ),
    );
    expect(wrapped).toEqual([]);
  });
}

test("at 375px the chips are one row that scrolls on its own, and the first card's top half is on the first screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(plan);
  const chips = page.getByRole("group", { name: "Mekân kategorileri" }).getByRole("button");
  const tops = await chips.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const row = page.getByRole("group", { name: "Mekân kategorileri" });
  expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const first = await cards(page).first().boundingBox();
  expect(first!.y + first!.height / 2).toBeLessThanOrEqual(812);
});

test("printing leaves out the hero, the carousel and the map, and keeps the plan and the budget", async ({ page }) => {
  await page.goto(plan);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#yerler")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Plan bölümleri" })).toBeHidden();
  await expect(page.locator("#gun-gun-plan")).toBeVisible();
  await expect(page.locator("#butce")).toBeVisible();
  await expect(page.locator("header.print\\:block h1")).toHaveText("Barselona");
});
