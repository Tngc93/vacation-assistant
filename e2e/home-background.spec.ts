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
