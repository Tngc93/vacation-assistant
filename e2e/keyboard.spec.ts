import { expect, test, type Locator, type Page } from "./fixtures";

/*
 * The whole trip by keyboard: home → "Planla" → the carousel → the chips → the day-by-day plan → the AI tab →
 * stays → flights → budget → footer. Every stop shows the focus ring and nothing traps the focus.
 */

/** The focused element's own outline, or its field frame's (borderless inputs ring their frame). */
async function expectRing(page: Page) {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    // Past the last link the focus leaves the page (the browser's own UI) before coming back to the top.
    if (el === document.body) return null;
    const own = getComputedStyle(el);
    const frame = el.closest(".field-focus-ring");
    const style = el.tagName === "INPUT" && frame ? getComputedStyle(frame) : own;
    const name = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`;
    return { style: style.outlineStyle, width: style.outlineWidth, name };
  });
  if (!ring) return;
  expect(ring.style, `focus ring on ${ring.name}`).not.toBe("none");
  expect(ring.width, `focus ring on ${ring.name}`).toBe("2px");
}

/** Tabs forward until `target` has the focus (at most `max` presses), checking the ring at every stop. */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    await expectRing(page);
    if (await target.evaluate((el) => el === document.activeElement)) return i + 1;
  }
  throw new Error(`Not reached within ${max} Tab presses`);
}

test("home to plan by keyboard: city, dates, 'Planla'", async ({ page }) => {
  await page.goto("/");
  const city = page.getByRole("combobox", { name: "Varış şehri" });
  await tabTo(page, city, 10);
  await page.keyboard.type("Barselona");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(city).toHaveValue("Barselona");

  const departButton = page.getByRole("button", { name: /^Gidiş/ });
  await tabTo(page, departButton, 3);
  await page.keyboard.press("Enter");
  const departCalendar = page.getByRole("dialog", { name: "Gidiş tarihini seç" });
  await expect(departCalendar).toBeVisible();
  // The calendar takes the focus; a week ahead, then three days later for the return.
  await expect(departCalendar.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const returnCalendar = page.getByRole("dialog", { name: "Dönüş tarihini seç" });
  await expect(returnCalendar).toBeVisible();
  await expect(returnCalendar.locator(":focus")).toHaveCount(1);
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(returnCalendar).toBeHidden();

  await tabTo(page, page.getByRole("button", { name: "Planla" }), 5);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/plan\?to=BCN&depart=\d{4}-\d\d-\d\d&return=\d{4}-\d\d-\d\d$/);
  await expect(page.getByRole("heading", { level: 1, name: "Barselona" })).toBeVisible();
});

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("the plan by keyboard: chips, one stop for the carousel, the plan, the AI tab, stays, flights, budget", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/plan?to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`);
  for (const id of ["yerler", "gun-gun-plan", "konaklama", "ucuslar", "butce"]) {
    await expect(page.locator(`main section#${id}`)).toBeVisible();
  }
  await expect(page.locator("#gun-gun-plan").getByRole("region", { name: /^1\. gün · / })).toBeVisible();

  // Chips come before the carousel; Space toggles one.
  const museum = page.getByRole("group", { name: "Mekân kategorileri" }).getByRole("button", { name: "Müze" });
  await tabTo(page, museum, 20);
  const pressed = await museum.getAttribute("aria-pressed");
  await page.keyboard.press("Space");
  await expect(museum).not.toHaveAttribute("aria-pressed", pressed!);
  await page.keyboard.press("Space");
  await expect(museum).toHaveAttribute("aria-pressed", pressed!);

  // The carousel is one Tab stop: the arrows, Home and End move inside it, the next Tab leaves it.
  const cards = page.getByRole("list", { name: "Görülecek yerler" }).getByRole("button");
  await tabTo(page, cards.first(), 10);
  await page.keyboard.press("ArrowRight");
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(cards.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(cards.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  // The arrows below stay in the Tab order at either end (aria-disabled), so the next stop does not depend on
  // how far the smooth scroll has got.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Önceki yer" })).toBeFocused();
  // Coming back with Shift+Tab lands on the card used last.
  await page.keyboard.press("Shift+Tab");
  await expect(cards.nth(1)).toBeFocused();

  // The AI tab opens its panel with the focus inside; Escape closes it and gives the focus back.
  const aiTab = page.locator("#gun-gun-plan").getByRole("button", { name: /^Yapay zekâ ile planla/ });
  await tabTo(page, aiTab, 20);
  await page.keyboard.press("Enter");
  const panel = page.locator("main #yapay-zeka-panel");
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(aiTab).toBeFocused();

  // On through the plan to the stay, the flights and the budget, then the footer.
  await tabTo(page, page.locator("#konaklama").getByRole("link", { name: /Booking/ }), 150);
  await tabTo(page, page.locator("#ucuslar").getByRole("button", { name: "Tüm uçuşları gör" }), 20);
  await tabTo(page, page.locator("#butce").getByRole("textbox").first(), 10);
  await tabTo(page, page.getByRole("contentinfo").getByRole("link", { name: "MIT lisansı" }), 20);
  // No trap: the next presses leave the page and come back to the top.
  await tabTo(page, page.getByRole("link", { name: "İçeriğe geç" }), 3);
});

test("the carousel's arrows keep the focus at the end of the row", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // A short row: the viewpoints only.
  await page.goto(`/plan?to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&cats=viewpoint`);
  const next = page.getByRole("button", { name: "Sonraki yer" });
  await expect(next).toHaveAttribute("aria-disabled", "false");
  await next.focus();
  // Enter until the row's end disables the arrow; the focus stays on it rather than dropping to the page.
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(next).toHaveAttribute("aria-disabled", "true", { timeout: 1_000 });
  }).toPass();
  await expect(next).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Önceki yer" })).toBeFocused();
});
