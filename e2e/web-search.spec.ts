import { expect, test, type Request } from "@playwright/test";

// e2e server: VA_AI_MOCK=1 (the keyless demo: the mock provider answers web searches, labelled ÖRNEK VERİ),
// VA_FLIGHTS_FIXTURES=1 and VA_OFFLINE=1 (no exchange rates, so only lira prices have a lira amount).
function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const plan = `/plan?from=IST&to=BCN&depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`;

test("web search for flights and stays (mock provider): sample-labelled, linked, and into the budget", async ({ page }) => {
  const requests: Request[] = [];
  page.on("request", (r) => requests.push(r));
  await page.goto(plan);
  const flights = page.locator("#ucuslar");
  const web = flights.getByRole("region", { name: "Web'de ara" });
  const receipt = page.locator("#butce").getByRole("region", { name: "Bütçe fişi" });
  const totalBefore = await receipt.locator("[aria-live]").innerText();

  // Nothing is searched until the button is pressed.
  await expect(web.getByRole("button", { name: "Web'de ara" })).toBeVisible();
  await expect(web.getByRole("article")).toHaveCount(0);
  await web.getByRole("button", { name: "Web'de ara" }).click();
  await expect(web.getByText("ÖRNEK VERİ · ÖRNEK SAĞLAYICI · GERÇEK FİYAT DEĞİL")).toBeVisible();
  await expect(web.getByRole("article")).toHaveCount(2);
  await expect(web.getByText(/YAPAY ZEKÂ WEB'DEN BULDU · SATIN ALMADAN ÖNCE DOĞRULA/)).toBeVisible();
  await expect(web.getByText(/1 sonuç gösterilmedi/)).toBeVisible();
  // The euro price has no rate offline: shown as found, without a lira amount or a budget button.
  await expect(web.getByText("EUR KURU ALINAMADI · TL KARŞILIĞI YOK")).toBeVisible();
  await expect(web.getByRole("link", { name: /Sitede gör · example\.com/ }).first()).toHaveAttribute("rel", "noopener noreferrer nofollow");

  await web.getByRole("button", { name: "Bütçeye ekle" }).click();
  await expect(page).toHaveURL(/wf=8450&wfs=example\.com/);
  await expect(page).not.toHaveURL(/[?&]flight=/);
  await expect(receipt.getByText("2 yolcu × 8.450 ₺ · web: example.com")).toBeVisible();
  await expect(receipt.getByText("YAPAY ZEKÂ WEB'DEN BULDU · TAHMİNİ")).toBeVisible();
  await expect(web.getByRole("button", { name: "Bütçede" })).toHaveCount(1);
  // The cached Travelpayouts tickets no longer say they are in the budget.
  await expect(flights.getByRole("button", { name: "Bütçede" })).toHaveCount(1);
  const totalWithWeb = await receipt.locator("[aria-live]").innerText();
  expect(totalWithWeb).not.toBe(totalBefore);

  // Stays: ranges by neighbourhood, the middle written into the nightly field.
  const stays = page.locator("#konaklama");
  await stays.getByRole("button", { name: "Semte göre fiyat aralığını web'de ara" }).click();
  await expect(stays.getByText("ÖRNEK VERİ · ÖRNEK SAĞLAYICI · GERÇEK FİYAT DEĞİL")).toBeVisible();
  await expect(stays.getByRole("listitem")).toHaveCount(3);
  await stays.getByRole("listitem").first().getByRole("button", { name: "Bütçeye yaz" }).click();
  await expect(page.locator("#butce").getByLabel("Gecelik konaklama (tüm odalar)")).toHaveValue("4300");
  await expect(page).toHaveURL(/stay=4300/);
  await expect(receipt.getByText("4 gece × 4.300 ₺")).toBeVisible();
  expect(await receipt.locator("[aria-live]").innerText()).not.toBe(totalWithWeb);

  // The same search in this tab comes back from sessionStorage, with no request to any provider (the demo
  // never uses the network at all), and the sample sites are never requested by the app.
  await page.reload();
  await expect(page.locator("#ucuslar").getByRole("region", { name: "Web'de ara" }).getByRole("article")).toHaveCount(2);
  await expect(page.locator("#ucuslar").getByRole("button", { name: "Yeniden ara" })).toBeVisible();
  for (const r of requests) expect(new URL(r.url()).hostname).not.toMatch(/example\.(com|org)$|googleapis|anthropic|openai/);
});
