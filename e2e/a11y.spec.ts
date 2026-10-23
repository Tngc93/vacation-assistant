import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const plan = `/plan?to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
const SECTIONS = ["yerler", "gun-gun-plan", "konaklama", "ucuslar", "butce"] as const;

/** Axe on the whole page (WCAG 2.x A and AA); serious and critical findings fail the test. */
async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) }));
  expect(serious).toEqual([]);
}

/** The plan streams in; axe runs once every section is in place (see plan-layout.spec.ts). */
async function planReady(page: Page) {
  for (const id of SECTIONS) await expect(page.locator(`main section#${id}`)).toBeVisible();
  await expect(page.locator("#gun-gun-plan").getByRole("region", { name: /^1\. gün · / })).toBeVisible();
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("home page has no serious accessibility violations", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Nereye gidiyorsun?" })).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test("plan page (AI panel closed) has no serious accessibility violations", async ({ page }) => {
      await page.goto(plan);
      await planReady(page);
      await expectNoSeriousViolations(page);
    });

    test("plan page (AI panel open) has no serious accessibility violations", async ({ page }) => {
      await page.goto(plan);
      await planReady(page);
      await page.locator("#gun-gun-plan").getByRole("button", { name: /^Yapay zekâ ile planla/ }).click();
      await expect(page.locator("main #yapay-zeka-panel")).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test("404 page has no serious accessibility violations", async ({ page }) => {
      await page.goto("/bu-sayfa-yok");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page);
    });
  });
}
