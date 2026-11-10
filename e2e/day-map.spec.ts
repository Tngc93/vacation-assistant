import { expect, test, type Page } from "./fixtures";

/*
 * The day map beside the day-by-day plan (DESIGN.md "Itinerary"): on desktop it follows the scroll, "Haritada
 * göster" forces a day without locking the map, its caption names the day, and the list's stops and the map's
 * numbered markers point at each other. Phones keep the map opened per day.
 *
 * The base map is a stub (one background layer): no test depends on OpenFreeMap's network. MapLibre still runs,
 * so the markers are real.
 */

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const trip = `depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
const STUB_STYLE = { version: 8, sources: {}, layers: [{ id: "background", type: "background" }] };

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/tiles\.openfreemap\.org\//, (route) =>
    route.request().url().includes("/styles/") ? route.fulfill({ json: STUB_STYLE }) : route.abort(),
  );
});

const plan = (page: Page) => page.locator("#gun-gun-plan");
const dayMap = (page: Page) => page.locator("[data-day-map]");
const mapRegion = (page: Page) => page.getByRole("region", { name: "Günün haritası" });
const dayRegion = (page: Page, n: number) => plan(page).getByRole("region", { name: new RegExp(`^${n}\\. gün · `) });

/** Puts the day's heading at `at` (a share of the viewport height from the top), as a reader's scroll would. */
async function scrollDay(page: Page, n: number, at = 0.15) {
  await expect(page.locator(`#gun-${n}`)).toBeVisible();
  await page.evaluate(
    ([day, share]) => {
      const heading = document.getElementById(`gun-${day}`)!;
      window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - window.innerHeight * share, behavior: "instant" });
    },
    [n, at] as const,
  );
}

/** "02 · 15 KAS PAZ": the day's number and the date its region is named with ("2. gün · 15 KAS PAZ"). */
async function caption(page: Page, n: number) {
  const name = (await dayRegion(page, n).getAttribute("aria-label"))!;
  return `${String(n).padStart(2, "0")} · ${name.split(" · ")[1]}`;
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the map follows the scroll: day 2 when its heading crosses the top 40%, day 1 again on the way back", async ({ page }) => {
    await page.goto(`/plan?from=IST&to=BCN&${trip}&pax=2`);
    await scrollDay(page, 1);
    await expect(dayMap(page)).toHaveAttribute("data-following", "scroll");
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "1");
    await expect(mapRegion(page)).toHaveAttribute("data-day", "1");

    await scrollDay(page, 2);
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "2");
    const label = dayMap(page).locator("p[aria-live=polite]");
    await expect(label).toHaveText(await caption(page, 2));
    // The map has switched to day 2's stops: one numbered marker per numbered stop in the list.
    await expect(mapRegion(page)).toHaveAttribute("data-day", "2");
    const listed = await dayRegion(page, 2).locator("li[data-stop]").count();
    await expect(mapRegion(page).locator("[data-stop-marker]")).toHaveCount(listed);
    // The day's button says so.
    await expect(dayRegion(page, 2).getByRole("button", { name: "Haritada gösteriliyor" })).toBeVisible();

    // Below the line, not yet crossed: still day 2.
    await scrollDay(page, 3, 0.55);
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "2");

    await scrollDay(page, 1);
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "1");
    await expect(label).toHaveText(await caption(page, 1));
    await expect(mapRegion(page)).toHaveAttribute("data-day", "1");
  });

  test("'Haritada göster' forces a day, and the map follows the scroll again afterwards", async ({ page }) => {
    await page.goto(`/plan?from=IST&to=BCN&${trip}&pax=2`);
    // Day 2's heading on screen but below the line: the active day is 1.
    await scrollDay(page, 2, 0.6);
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "1");

    await dayRegion(page, 2).getByRole("button", { name: "Haritada göster" }).click();
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "2");
    await expect(mapRegion(page)).toHaveAttribute("data-day", "2");

    // Not locked: crossing day 3 moves the map on, scrolling back up brings day 1.
    await scrollDay(page, 3);
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "3");
    await scrollDay(page, 1);
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "1");
  });

  test("hovering or focusing a stop lights its marker; clicking a marker brings its stop into view", async ({ page }) => {
    await page.goto(`/plan?from=IST&to=BCN&${trip}&pax=2`);
    await scrollDay(page, 2);
    await expect(mapRegion(page)).toHaveAttribute("data-day", "2");
    const marker = (n: number) => mapRegion(page).locator(`[data-stop-marker="${n}"]`);
    const stop = (n: number) => page.locator(`#gun-2-durak-${n}`);

    await stop(2).hover();
    await expect(marker(2)).toHaveAttribute("data-highlighted", "true");
    await expect(marker(1)).toHaveAttribute("data-highlighted", "false");
    await page.mouse.move(0, 0);
    await expect(marker(2)).toHaveAttribute("data-highlighted", "false");

    await stop(3).getByRole("link").first().focus();
    await expect(marker(3)).toHaveAttribute("data-highlighted", "true");

    // The last stop is off screen below; its marker brings it up and gives it the focus.
    const last = await dayRegion(page, 2).locator("li[data-stop]").count();
    await expect(marker(last)).toHaveAccessibleName(/^\d+\. durak: .+\. Planda göster$/);
    await marker(last).click();
    await expect(stop(last)).toBeFocused();
    await expect(stop(last)).toBeInViewport();
    await expect(marker(last)).toHaveAttribute("data-highlighted", "true");
    // Still day 2 on the map.
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "2");
  });

  test("Moscow: places inside the Kremlin share its marker, and the markers number as the list does", async ({ page }) => {
    await page.goto(`/plan?to=MOW&${trip}`);
    const inside = plan(page).getByRole("list", { name: "Moskova Kremlini içinde" });
    await expect(inside).toBeVisible();
    const kremlin = inside.locator("xpath=ancestor::li[@data-stop][1]");
    const id = (await kremlin.getAttribute("id"))!;
    const [, day, number] = id.match(/^gun-(\d+)-durak-(\d+)$/)!;

    await scrollDay(page, Number(day));
    await expect(mapRegion(page)).toHaveAttribute("data-day", day);
    const region = dayRegion(page, Number(day));
    const numbers = await region.locator("li[data-stop]").evaluateAll((items) => items.map((li) => li.getAttribute("data-stop")));
    const markers = await mapRegion(page)
      .locator("[data-stop-marker]")
      .evaluateAll((items) => items.map((el) => el.getAttribute("data-stop-marker")));
    expect(markers).toEqual(numbers);
    expect(markers).toEqual(markers.map((_, i) => String(i + 1)));

    // Hovering the Tsar Cannon lights the Kremlin's marker.
    await inside.getByText(/^Çar Topu/).hover();
    await expect(mapRegion(page).locator(`[data-stop-marker="${number}"]`)).toHaveAttribute("data-highlighted", "true");
  });

  test("with reduced motion the map jumps to the day; otherwise it eases over 400 ms", async ({ page }) => {
    await page.goto(`/plan?from=IST&to=BCN&${trip}&pax=2`);
    await scrollDay(page, 1);
    await expect(mapRegion(page)).toHaveAttribute("data-day", "1");
    await scrollDay(page, 2);
    await expect(mapRegion(page)).toHaveAttribute("data-day", "2");
    await expect(mapRegion(page)).toHaveAttribute("data-fit-duration", "400");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await scrollDay(page, 3);
    await expect(mapRegion(page)).toHaveAttribute("data-day", "3");
    await expect(mapRegion(page)).toHaveAttribute("data-fit-duration", "0");
  });
});

test.describe("phones", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the map still opens per day and does not follow the scroll", async ({ page }) => {
    await page.goto(`/plan?from=IST&to=BCN&${trip}&pax=2`);
    await expect(plan(page).getByRole("button", { name: "Haritada göster" }).first()).toBeVisible();
    await expect(plan(page).getByRole("button", { name: "Haritada gösteriliyor" })).toHaveCount(0);
    await expect(dayMap(page)).toHaveCount(0);

    await dayRegion(page, 3).getByRole("button", { name: "Haritada göster" }).click();
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "3");
    await expect(dayMap(page)).toHaveAttribute("data-following", "manual");
    await expect(dayRegion(page, 3).getByRole("button", { name: "Haritada gösteriliyor" })).toBeVisible();

    // Scrolling the days leaves the map on day 3.
    await scrollDay(page, 1);
    await scrollDay(page, 2);
    await page.waitForTimeout(500); // longer than the desktop's debounce: a follow would have happened by now
    await expect(dayMap(page)).toHaveAttribute("data-active-day", "3");
  });
});
