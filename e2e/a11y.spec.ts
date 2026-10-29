import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures";

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const query = `?to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
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

/** Each language's pages and the names the checks wait for. */
const LANGUAGES = [
  { name: "Turkish", prefix: "", home: "Nereye gidiyorsun?", day: /^1\. gün · /, ai: /^Yapay zekâ ile planla/, missing: "/bu-sayfa-yok" },
  { name: "English", prefix: "/en", home: "Where are you going?", day: /^Day 1 · /, ai: /^Plan with AI/, missing: "/en/no-such-page" },
] as const;

/** The plan streams in; axe runs once every section is in place (see plan-layout.spec.ts). */
async function planReady(page: Page, day: RegExp) {
  for (const id of SECTIONS) await expect(page.locator(`main section#${id}`)).toBeVisible();
  await expect(page.locator("#gun-gun-plan").getByRole("region", { name: day })).toBeVisible();
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
}

for (const language of LANGUAGES) {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`${language.name}, ${colorScheme} theme`, () => {
      test.use({ colorScheme });
      const plan = `${language.prefix}/plan${query}`;

      test("home page has no serious accessibility violations", async ({ page }) => {
        await page.goto(language.prefix || "/");
        await expect(page.getByRole("heading", { level: 1, name: language.home })).toBeVisible();
        await expectNoSeriousViolations(page);
      });

      test("plan page (AI panel closed) has no serious accessibility violations", async ({ page }) => {
        await page.goto(plan);
        await planReady(page, language.day);
        await expectNoSeriousViolations(page);
      });

      test("plan page (AI panel open) has no serious accessibility violations", async ({ page }) => {
        await page.goto(plan);
        await planReady(page, language.day);
        await page.locator("#gun-gun-plan").getByRole("button", { name: language.ai }).click();
        await expect(page.locator("main #yapay-zeka-panel")).toBeVisible();
        await expectNoSeriousViolations(page);
      });

      test("404 page has no serious accessibility violations", async ({ page }) => {
        await page.goto(language.missing);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoSeriousViolations(page);
      });
    });
  }
}
