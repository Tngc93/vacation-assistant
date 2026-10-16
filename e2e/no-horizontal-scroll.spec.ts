import { expect, test } from "@playwright/test";

const WIDTHS = [320, 375, 768] as const;

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const PAGES = [
  { name: "home", path: "/" },
  {
    name: "plan (valid link)",
    path: `/plan?from=IST&to=SJJ&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`,
  },
  { name: "plan (invalid link)", path: "/plan?from=IST&to=XXX&depart=2020-01-01&pax=12" },
  { name: "styleguide", path: "/styleguide" },
];

for (const width of WIDTHS) {
  for (const { name, path } of PAGES) {
    test(`${name} has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      // Let streamed sections (rates) arrive before measuring.
      await page.waitForLoadState("networkidle");

      const result = await page.evaluate(() => {
        const root = document.documentElement;
        const viewport = root.clientWidth;
        // Report the outermost elements that stick out, to make failures actionable.
        const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => el.getBoundingClientRect().right > viewport + 0.5)
          .filter((el) => !el.parentElement || el.parentElement.getBoundingClientRect().right <= viewport + 0.5)
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}px`);
        return { scrollWidth: root.scrollWidth, clientWidth: viewport, offenders };
      });

      expect(result.scrollWidth, `overflowing: ${result.offenders.join(" | ") || "none found"}`).toBeLessThanOrEqual(
        result.clientWidth,
      );
    });
  }
}
