import { expect, test, type Page } from "./fixtures";

/** The route map behind the home hero (DESIGN.md "Home background"); it starts once the page is idle. */
const map = (page: Page) => page.locator("canvas[data-home-background]");

async function mapReady(page: Page) {
  await expect(map(page)).toHaveAttribute("data-ready", "");
}

for (const { name, path, chip, other } of [
  { name: "Turkish", path: "/", chip: "Paris", other: "Roma" },
  { name: "English", path: "/en", chip: "Paris", other: "Rome" },
] as const) {
  test.describe(`${name} home background`, () => {
    test("is decoration only: hidden from assistive technology, never focusable, never in the way", async ({ page }) => {
      await page.goto(path);
      await mapReady(page);
      const canvas = map(page);
      await expect(canvas).toHaveAttribute("aria-hidden", "true");
      await expect(canvas).toHaveCSS("pointer-events", "none");
      await expect(canvas).not.toHaveAttribute("tabindex");
      expect(await canvas.evaluate((el) => (el.focus(), document.activeElement === el))).toBe(false);

      // A point with nothing but the map under it hits the page, not the canvas; a chip still takes its click.
      const box = (await canvas.boundingBox())!;
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [box.x + box.width - 8, box.y + box.height - 8]);
      expect(hit).not.toBe("CANVAS");
      await page.getByRole("button", { name: chip, exact: true }).click();
      await expect(page.getByRole("button", { name: chip, exact: true })).toHaveAttribute("aria-pressed", "true");
    });

    test("draws a route to the city chosen, and previews a focused chip", async ({ page }) => {
      await page.goto(path);
      await mapReady(page);
      await expect(map(page)).toHaveAttribute("data-motion", "running");

      await page.getByRole("button", { name: other, exact: true }).focus();
      await expect(map(page)).toHaveAttribute("data-route", "ROM");
      await page.getByRole("button", { name: chip, exact: true }).click();
      await page.keyboard.press("Escape");
      await expect(map(page)).toHaveAttribute("data-route", "PAR");
    });
  });
}

/** WCAG relative luminance contrast of two `rgb()` colours. */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = c.match(/[\d.]+/g)!.slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`keeps every word on solid paper over the map, in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await mapReady(page);
    // Routes, labels and the pointer's glow all on screen.
    await page.getByRole("button", { name: "Roma", exact: true }).click();
    await page.keyboard.press("Escape");
    // The tagline, the title, the lead and the "Keşfet" label.
    const scrimmed = page.locator("main .home-scrim");
    await expect(scrimmed).toHaveCount(4);
    const words = await scrimmed.all();
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    await page.mouse.move(title.x + title.width, title.y);
    await page.waitForTimeout(2500);

    for (const word of words) {
      const { text, scrim, covers } = await word.evaluate((el) => {
        const before = getComputedStyle(el, "::before");
        return {
          text: getComputedStyle(el).color,
          scrim: before.backgroundColor,
          covers: ["top", "right", "bottom", "left"].every((side) => parseFloat(before.getPropertyValue(side)) <= 0),
        };
      });
      expect(covers).toBe(true);
      expect(contrast(text, scrim)).toBeGreaterThanOrEqual(4.5);
      // The words look the same with and without the map under them: nothing of it shows through.
      const withMap = await word.screenshot();
      await map(page).evaluate((c) => (c.style.visibility = "hidden"));
      const withoutMap = await word.screenshot();
      await map(page).evaluate((c) => (c.style.visibility = ""));
      expect(withMap.equals(withoutMap)).toBe(true);
    }
  });
}

test("is still with reduced motion: no loop, no routes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await mapReady(page);
  await expect(map(page)).toHaveAttribute("data-motion", "static");
  await page.getByRole("button", { name: "Paris", exact: true }).click();
  await expect(page.getByRole("button", { name: "Paris", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(map(page)).not.toHaveAttribute("data-route");
  // The canvas does not change from one moment to the next.
  const first = await map(page).evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.waitForTimeout(500);
  expect(await map(page).evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(first);
});

test("pauses while the tab is hidden", async ({ page }) => {
  await page.goto("/");
  await mapReady(page);
  await expect(map(page)).toHaveAttribute("data-motion", "running");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(map(page)).toHaveAttribute("data-motion", "paused");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(map(page)).toHaveAttribute("data-motion", "running");
});

test("on a phone, draws the chosen city's route", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await mapReady(page);
  await page.getByRole("button", { name: "Roma", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(map(page)).toHaveAttribute("data-route", "ROM");
});
