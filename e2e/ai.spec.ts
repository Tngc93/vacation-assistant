import { expect, test, type Page, type Request } from "./fixtures";

// The AI provider is mocked with page.route: no key, no network. The page calls the provider straight from the
// browser, so the mock sits where api.openai.com would answer.
function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const trip = `depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}&pax=2`;
const KEY = "sk-e2e-test-key-not-real";

type Data = { days: Array<{ day: number; window: string | null }>; candidates: Array<{ id: string; closedDays: number[] }>; plan?: Array<{ stops: Array<{ id: string }> }> };

/** A fake OpenAI: lists two models, plans the first day with a window from the candidates, removes on request. */
async function mockOpenAi(page: Page) {
  await page.route("https://api.openai.com/v1/models", (route) =>
    route.fulfill({ json: { data: [{ id: "gpt-5", created: 2 }, { id: "gpt-5-mini", created: 1 }, { id: "whisper-1", created: 3 }] } }),
  );
  await page.route("https://api.openai.com/v1/chat/completions", (route) => {
    const body = route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> };
    const user = body.messages[1].content;
    const data = JSON.parse(user.slice(user.indexOf("DATA:\n") + 6)) as Data;
    let answer: unknown;
    if (user.startsWith("REQUEST:")) {
      const first = data.plan!.flatMap((d) => d.stops)[0];
      answer = { commands: [{ op: "remove", id: first.id }], reply: "İlk durağı çıkardım." };
    } else {
      const day = data.days.find((d) => d.window && d.day > 1) ?? data.days.find((d) => d.window)!;
      const stops = data.candidates.filter((c) => !c.closedDays.includes(day.day)).slice(0, 3).map((c) => c.id);
      answer = { days: data.days.map((d) => ({ day: d.day, stops: d.day === day.day ? stops : [], reason: d.day === day.day ? "Şehrin en bilinen yerleri, yakın yakın." : "Boş." })) };
    }
    return route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(answer) } }] } });
  });
}

test("the page may connect only to our origin, the map tiles and the three AI providers", async ({ page }) => {
  const response = await page.goto(`/plan?from=IST&to=BCN&${trip}`);
  const csp = response!.headers()["content-security-policy"];
  expect(csp).toContain(
    "connect-src 'self' https://tiles.openfreemap.org https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com;",
  );
  expect(csp).not.toContain("unsafe-eval");
});

test("connect a mocked provider, plan with AI, edit by chat and undo; the key never reaches our server", async ({ page }) => {
  const requests: Request[] = [];
  page.on("request", (r) => requests.push(r));
  await mockOpenAi(page);
  await page.goto(`/plan?from=IST&to=BCN&${trip}`);
  const panel = page.getByRole("region", { name: "Yapay zekâ ile planla" });
  await expect(panel.getByText("Anahtarın bu tarayıcıda kalır, sunucumuza gönderilmez. Kullanım senin hesabından ücretlendirilir.")).toBeVisible();

  await panel.getByRole("button", { name: "OpenAI" }).click();
  await panel.getByLabel("API anahtarı").fill(KEY);
  await panel.getByRole("button", { name: "Bağlan" }).click();
  await expect(panel.getByLabel(/^Model/)).toHaveValue("gpt-5-mini");
  await panel.getByRole("button", { name: "Bağlandı, devam et" }).click();

  await panel.getByRole("button", { name: "Yapay zekâyla planla" }).click();
  const plan = page.locator("#gun-gun-plan");
  await expect(plan.getByText("Şehrin en bilinen yerleri, yakın yakın.")).toBeVisible();
  await expect(plan.getByText("YAPAY ZEKÂ GEREKÇESİ")).toBeVisible();
  await expect(page).toHaveURL(/[?&]ai=[nwrq\d._]+/);

  await panel.getByLabel("Planı sohbetle değiştir").fill("İlk durağı çıkar");
  await panel.getByRole("button", { name: "Uygula" }).click();
  await expect(panel.getByText("İlk durağı çıkardım.")).toBeVisible();
  await expect(panel.getByText(/^Çıkarıldı: /)).toBeVisible();
  await expect(page).toHaveURL(/[?&]edit=rm-[nwrq]\d+/);
  await panel.getByRole("button", { name: "Geri al" }).click();
  await expect(page).not.toHaveURL(/[?&]edit=/);

  // The shared link reopens the AI plan (its stops; the reasons stay with the browser that made it).
  const shared = await page.context().newPage();
  await shared.goto(page.url());
  await expect(shared.locator("#gun-gun-plan").getByText(/Duraklar yapay zekâ tarafından bu şehrin listesinden seçildi/)).toBeVisible();

  const withKey = requests.filter((r) => [r.url(), JSON.stringify(r.headers()), r.postData() ?? ""].some((s) => s.includes(KEY)));
  expect(withKey.length).toBeGreaterThan(0);
  for (const r of withKey) expect(new URL(r.url()).origin).toBe("https://api.openai.com");
  expect(page.url()).not.toContain(KEY);
});
