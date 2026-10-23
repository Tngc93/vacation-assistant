import { expect, test as base } from "@playwright/test";

/**
 * Every page fails Wikimedia images at once, so no test depends on Commons' network. It also pins down the
 * timing CI showed: without slow images `load` comes early, before React has revealed the streamed sections,
 * so a test that measures must wait for what it measures (see plan-layout.spec.ts).
 */
export const test = base.extend({
  // Playwright's fixture callback (named `provide` here; `use` reads as a React hook to the linter).
  page: async ({ page }, provide) => {
    await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) => route.abort());
    await provide(page);
  },
});

export { expect };
export type { Locator, Page, Request } from "@playwright/test";
