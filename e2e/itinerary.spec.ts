import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// e2e server: VA_FLIGHTS_FIXTURES=1 (labelled sample flights), pre-fetched place files, no network.
function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const trip = `depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`;

test("Barcelona: a 5-day plan that follows the budget's flight, with remove, reset and a shareable link", async ({ page, context }) => {
  await page.goto(`/plan?from=IST&to=BCN&${trip}`);
  const plan = page.locator("#gun-gun-plan");
  await expect(plan.getByText(/^UÇUŞ: /)).toBeVisible();
  await expect(plan.getByRole("region", { name: /\. gün · / })).toHaveCount(5);

  const remove = plan.getByRole("button", { name: /durağını plandan çıkar$/ }).first();
  const label = (await remove.getAttribute("aria-label"))!;
  const name = label.replace(/ durağını plandan çıkar$/, "");
  await remove.click();
  await expect(page).toHaveURL(/skip=[nwr]\d+/);
  await expect(plan.getByRole("button", { name: label })).toHaveCount(0);
  await expect(plan.getByRole("button", { name: "Planı sıfırla (1)" })).toBeVisible();

  // The link reopens the same plan.
  const shared = await context.newPage();
  await shared.goto(page.url());
  await expect(shared.locator("#gun-gun-plan").getByRole("button", { name: "Planı sıfırla (1)" })).toBeVisible();
  await expect(shared.locator("#gun-gun-plan").getByRole("button", { name: label })).toHaveCount(0);

  await plan.getByRole("button", { name: "Planı sıfırla (1)" }).click();
  await expect(plan.getByRole("button", { name: label })).toBeVisible();
  await expect(page).not.toHaveURL(/skip=/);
  expect(name.length).toBeGreaterThan(0);
});

test("the plan downloads as a calendar file", async ({ page }) => {
  await page.goto(`/plan?from=IST&to=BCN&${trip}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#gun-gun-plan").getByRole("button", { name: /Takvime ekle/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("barselona-gezi-plani.ics");
  const text = readFileSync((await download.path())!, "utf8");
  expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(text).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid");
  expect(text.match(/BEGIN:VEVENT/g)?.length).toBeGreaterThan(5);
});

test("Sarajevo without flights: half days, marked as an assumption", async ({ page }) => {
  await page.goto(`/plan?from=IST&to=SJJ&${trip}`);
  const plan = page.locator("#gun-gun-plan");
  await expect(plan.getByText(/UÇUŞ SEÇİLMEDİ · VARSAYIM/)).toBeVisible();
  const first = plan.getByRole("region", { name: /^1\. gün · / });
  await expect(first.getByText(/VARIŞ GÜNÜ · YARIM GÜN · 13:00–/)).toBeVisible();
  const last = plan.getByRole("region", { name: /^5\. gün · / });
  await expect(last.getByText(/DÖNÜŞ GÜNÜ · YARIM GÜN · 09:00–13:00/)).toBeVisible();
});
