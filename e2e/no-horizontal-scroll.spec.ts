import { expect, test } from "./fixtures";

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
  {
    name: "plan (all city-guide categories)",
    path: `/plan?from=ESB&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=1&cats=see,museum,viewpoint,restaurant,cafe,cocktail,pub,club`,
  },
  {
    // Flight ticket cards (sample prices: the e2e server runs with VA_FLIGHTS_FIXTURES=1).
    name: "plan (flight tickets)",
    path: `/plan?from=IST&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`,
  },
  {
    // A filled budget in the destination's currency, with a chosen flight.
    name: "plan (filled budget)",
    path: `/plan?from=ESB&to=LON&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=4&stay=1234567.89&daily=98765.43&cur=GBP`,
  },
  { name: "plan (invalid link)", path: "/plan?from=IST&to=XXX&depart=2020-01-01&pax=12" },
  { name: "styleguide", path: "/styleguide" },
];

for (const width of WIDTHS) {
  for (const { name, path } of PAGES) {
    test(`${name} has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      // Let streamed sections (rates) arrive before measuring, and React reveal them: every loading
      // skeleton (aria-busy) is gone once the page is final.
      await page.waitForLoadState("networkidle");
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      const result = await page.evaluate(() => {
        const root = document.documentElement;
        const viewport = root.clientWidth;
        // Report the outermost elements that stick out, to make failures actionable.
        const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => el.getBoundingClientRect().right > viewport + 0.5)
          .filter((el) => !el.parentElement || el.parentElement.getBoundingClientRect().right <= viewport + 0.5)
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}px`);
        // Plan sections keep the 16px side gutter: one wide child would widen the whole column.
        const gutterBreaks = [...document.querySelectorAll<HTMLElement>("main section[id]")]
          .filter((el) => el.getBoundingClientRect().right > viewport - 16 + 0.5)
          .map((el) => `#${el.id} → ${Math.round(el.getBoundingClientRect().right)}px`);
        return { scrollWidth: root.scrollWidth, clientWidth: viewport, offenders, gutterBreaks };
      });

      expect(result.scrollWidth, `overflowing: ${result.offenders.join(" | ") || "none found"}`).toBeLessThanOrEqual(
        result.clientWidth,
      );
      expect(result.gutterBreaks, "sections past the 16px gutter").toEqual([]);
    });
  }
}
