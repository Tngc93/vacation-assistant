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

/** The AI tab next to the plan section's title. */
const aiTab = (page: Page) => page.locator("#gun-gun-plan").getByRole("button", { name: /^Yapay zekâ ile planla/ });
// In <main>: while the plan streams in, React may hold a copy at the end of <body> before revealing it.
const aiPanel = (page: Page) => page.locator("main #yapay-zeka-panel");

async function openPanel(page: Page) {
  // The plan (and its panel) in place first: the tab sits outside the plan's Suspense boundary.
  await expect(page.locator("#gun-gun-plan").getByRole("region", { name: /^1\. gün · / })).toBeVisible();
  await expect(aiTab(page)).toBeVisible();
  await aiTab(page).click();
  await expect(aiPanel(page)).toBeVisible();
}

async function connectOpenAi(page: Page) {
  const panel = page.getByRole("region", { name: "Yapay zekâ ile planla" });
  await panel.getByRole("button", { name: "OpenAI" }).click();
  await panel.getByLabel("API anahtarı").fill(KEY);
  await panel.getByRole("button", { name: "Bağlan" }).click();
  await expect(panel.getByLabel(/^Model/)).toHaveValue("gpt-5-mini");
  await panel.getByRole("button", { name: "Bağlandı, devam et" }).click();
}

const firstStop = (page: Page) => page.locator("#gun-gun-plan").getByRole("button", { name: /durağını plandan çıkar$/ }).first();

test("the plan comes first: the first day is on screen before the AI panel, which opens on the side and closes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/plan?to=BCN&${trip}`);
  const firstDay = page.locator("#gun-gun-plan").getByRole("region", { name: /^1\. gün · / });
  await expect(firstDay).toBeVisible();
  // With the section's title at the top of the screen, the first day is already on it.
  await page.locator("#gun-gun-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect(firstDay).toBeInViewport();
  await expect(aiPanel(page)).toBeHidden();
  // The days come before the panel in the page.
  expect(await firstDay.evaluate((d) => Boolean(d.compareDocumentPosition(document.getElementById("yapay-zeka-panel")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

  // The edge tab is there while the plan is on screen.
  const edge = page.getByRole("button", { name: "Yapay zekâ panelini aç" });
  await expect(edge).toBeVisible();

  await aiTab(page).click();
  await expect(aiPanel(page)).toBeVisible();
  await expect(aiPanel(page)).toBeFocused();
  await expect(aiTab(page)).toHaveAttribute("aria-expanded", "true");
  await expect(edge).toBeHidden();
  // Not modal: the days stay on screen, left of the panel.
  await expect(firstDay).toBeVisible();
  // Measured once the slide-in has settled.
  await expect.poll(async () => Math.round((await aiPanel(page).boundingBox())!.x)).toBe(Math.round((await page.locator("#gun-gun-plan").boundingBox())!.x + (await page.locator("#gun-gun-plan").boundingBox())!.width - 420));
  const dayBox = await firstDay.boundingBox();
  const panelBox = await aiPanel(page).boundingBox();
  expect(panelBox!.x).toBeGreaterThanOrEqual(dayBox!.x + dayBox!.width);
  expect(Math.round(panelBox!.width)).toBe(420);

  await page.keyboard.press("Escape");
  await expect(aiPanel(page)).toBeHidden();
  await expect(aiTab(page)).toBeFocused();

  await edge.click();
  await expect(aiPanel(page)).toBeVisible();
  await page.getByRole("button", { name: "Yapay zekâ panelini kapat" }).click();
  await expect(aiPanel(page)).toBeHidden();
  await expect(edge).toBeFocused();
  // Open or closed, the panel is not in the link.
  expect(new URL(page.url()).search).toBe(`?to=BCN&${trip}`);
});

test("on a phone the panel is a full-screen sheet; applying a chat edit closes it and the list changes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockOpenAi(page);
  await page.goto(`/plan?to=BCN&${trip}`);
  // Full width under the section title.
  await expect(aiTab(page)).toBeVisible();
  const tabBox = await aiTab(page).boundingBox();
  expect(Math.round(tabBox!.width)).toBe(375 - 32);

  await openPanel(page);
  const sheet = page.getByRole("dialog", { name: "Yapay zekâ ile planla" });
  await expect(sheet).toBeVisible();
  // Slides up from the bottom, then covers the screen.
  await expect.poll(async () => (await sheet.boundingBox())?.y).toBe(0);
  expect(await sheet.boundingBox()).toEqual({ x: 0, y: 0, width: 375, height: 812 });
  await connectOpenAi(page);

  // The edit removes the plan's first stop.
  const removed = (await firstStop(page).getAttribute("aria-label"))!;
  await sheet.getByLabel("Planı sohbetle değiştir").fill("İlk durağı çıkar");
  await sheet.getByRole("button", { name: "Uygula" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator("#gun-gun-plan").getByRole("button", { name: removed, exact: true })).toHaveCount(0);
  const changed = page.locator('#gun-gun-plan [data-changed="true"]').first();
  await expect(changed).toBeInViewport();
  await expect(page).toHaveURL(/[?&]edit=rm-[nwrq]\d+/);
  // The tab marks the change; the panel shows its summary and undo.
  await expect(aiTab(page)).toHaveAccessibleName(/yeni değişiklik/);
  await aiTab(page).click();
  await expect(sheet.getByText("İlk durağı çıkardım.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Geri al" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

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
  // The panel opens from its tab beside the plan's title (a side panel on this desktop screen).
  await openPanel(page);
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
