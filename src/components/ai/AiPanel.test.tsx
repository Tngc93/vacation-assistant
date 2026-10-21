import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItineraryView } from "@/components/itinerary/ItineraryView";
import { mockProvider } from "@/lib/ai/mockProvider";
import { EVENING, SIGHTS } from "@/lib/itinerary/testCity";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map" /> }));

const KEY = "test-key-not-real";
const SEARCH = "from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2";
const input = { depart: "2026-11-14", return: "2026-11-18", timeZone: "Europe/Madrid", flight: null, daytime: SIGHTS, evening: EVENING };
const cocktails = [{ ...EVENING[0], id: "node/7001", name: "Kokteyl Bar", category: "cocktail" as const }];

const plan = JSON.stringify({
  days: [
    { day: 1, stops: ["n200"], reason: "Varış günü yakın bir yer." },
    { day: 2, stops: ["n100", "n101", "n104"], reason: "En bilinen yerler, yürüyerek sırayla." },
    { day: 3, stops: ["n300"], reason: "Üçüncü bölge." },
    { day: 4, stops: [], reason: "Boş." },
    { day: 5, stops: [], reason: "Boş." },
  ],
});
const edit = JSON.stringify({
  commands: [
    { op: "remove", id: "n101" },
    { op: "evening", categories: ["cocktail"] },
  ],
  reply: "2. günden bir müzeyi çıkardım, akşamları kokteyl bar önerdim.",
});

function renderView(fetcher: typeof fetch) {
  return render(
    <ItineraryView
      input={input}
      initialSkip={[]}
      cityName="Barselona"
      center={{ lat: 41.39, lon: 2.17 }}
      eveningPool={{ restaurant: EVENING, cocktail: cocktails }}
      initialEvening={["restaurant"]}
      aiFetch={fetcher}
    />,
  );
}
const day = (n: number) => screen.getByRole("region", { name: new RegExp(`^${n}\\. gün · `) });

async function connect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Google Gemini" }));
  await user.type(screen.getByLabelText("API anahtarı"), KEY);
  await user.click(screen.getByRole("button", { name: "Bağlan" }));
  await screen.findByLabelText(/^Model/);
}

describe("AI connection, plan and chat edits", () => {
  beforeEach(() => window.history.replaceState(null, "", `/plan?${SEARCH}#gun-gun-plan`));
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("explains where the key stays and who pays, and links to key pages, the free tier marked", () => {
    renderView(mockProvider("gemini", []).fetcher);
    expect(screen.getByText("Anahtarın bu tarayıcıda kalır, sunucumuza gönderilmez. Kullanım senin hesabından ücretlendirilir.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google Gemini anahtarı al" })).toHaveAttribute("href", "https://aistudio.google.com/app/apikey");
    expect(screen.getByText(/ücretsiz katmanı var/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Bu cihazda hatırla/ })).not.toBeChecked();
  });

  it("connects, suggests a fast model, plans with the model's choice and reasons, then edits by chat and undoes", async () => {
    const user = userEvent.setup();
    const mock = mockProvider("gemini", [plan, edit], ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]);
    renderView(mock.fetcher);
    await connect(user);
    expect(screen.getByLabelText(/^Model/)).toHaveValue("gemini-2.5-flash");
    expect(window.sessionStorage.getItem("va.ai.connection")).toContain(KEY);
    await user.click(screen.getByRole("button", { name: "Bağlandı, devam et" }));

    await user.click(screen.getByRole("button", { name: "Yapay zekâyla planla" }));
    await screen.findByText("En bilinen yerler, yürüyerek sırayla.");
    expect(within(day(2)).getByText("YAPAY ZEKÂ GEREKÇESİ")).toBeInTheDocument();
    const stops = within(day(2)).getAllByRole("button", { name: /durağını plandan çıkar$/ }).map((b) => b.getAttribute("aria-label"));
    expect(stops.slice(0, 3)).toEqual(["Sight 0-0 durağını plandan çıkar", "Sight 0-1 durağını plandan çıkar", "Sight 0-4 durağını plandan çıkar"]);
    expect(screen.getByText(/Duraklar yapay zekâ \(Google Gemini · gemini-2\.5-flash\) tarafından/)).toBeInTheDocument();
    expect(window.location.search).toContain("ai=n200_n100.n101.n104_n300__");

    await user.type(screen.getByLabelText("Planı sohbetle değiştir"), "2. günü müzesiz yap");
    await user.click(screen.getByRole("button", { name: "Uygula" }));
    await screen.findByText("2. günden bir müzeyi çıkardım, akşamları kokteyl bar önerdim.");
    expect(screen.getByText("Çıkarıldı: Sight 0-1 (2. gün)")).toBeInTheDocument();
    // Evening places now come from the cocktail bars (one here, suggested once in the plan).
    expect(screen.getByText("Kokteyl Bar")).toBeInTheDocument();
    expect(screen.queryByText("Dinner 0-0")).not.toBeInTheDocument();
    expect(window.location.search).toContain("edit=rm-n101.eve-cocktail");

    await user.click(screen.getByRole("button", { name: "Geri al" }));
    expect(within(day(2)).getByText("Sight 0-1")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("edit")).toBeNull();

    // The key went only to the provider, never into the page's URL.
    expect(window.location.href).not.toContain(KEY);
    for (const r of mock.requests) expect(r.url.startsWith("https://generativelanguage.googleapis.com/")).toBe(true);
  });

  it("keeps the plan and says so calmly when the key is wrong or the model keeps breaking the rules", async () => {
    const user = userEvent.setup();
    const wrongKey: typeof fetch = async () => Response.json({ error: { type: "authentication_error" } }, { status: 401 });
    renderView(wrongKey);
    await user.type(screen.getByLabelText("API anahtarı"), KEY);
    await user.click(screen.getByRole("button", { name: "Bağlan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Anahtar geçersiz ya da bu sağlayıcıya ait değil.");
  });

  it("falls back to the deterministic plan after two invalid answers", async () => {
    const user = userEvent.setup();
    const invalid = JSON.stringify({ days: [{ day: 2, stops: ["n100", "w123456"], reason: "x" }] });
    const mock = mockProvider("gemini", [invalid, invalid], ["gemini-2.5-flash"]);
    renderView(mock.fetcher);
    await connect(user);
    await user.click(screen.getByRole("button", { name: "Bağlandı, devam et" }));
    const before = within(day(2)).getAllByRole("button", { name: /durağını plandan çıkar$/ }).length;
    await user.click(screen.getByRole("button", { name: "Yapay zekâyla planla" }));
    await screen.findByText(/iki denemede de yalnızca listedeki yerlerle geçerli bir plan veremedi; mevcut plan kaldı/);
    expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument(); // the caption names the model; no HTTP status here
    expect(within(day(2)).getAllByRole("button", { name: /durağını plandan çıkar$/ })).toHaveLength(before);
    expect(window.location.search).not.toContain("ai=");
    expect(mock.requests.filter((r) => r.method === "POST")).toHaveLength(2);
  });

  it("locks Uygula while a request runs, then shows the error with its caption and keeps the text", async () => {
    const user = userEvent.setup();
    const mock = mockProvider("gemini", [], ["gemini-2.5-flash"]);
    let release: () => void = () => {};
    let posts = 0;
    const perDay = {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }],
      },
    };
    const fetcher: typeof fetch = async (input, init) => {
      if ((init?.method ?? "GET") === "GET") return mock.fetcher(input, init);
      posts++;
      await new Promise<void>((resolve) => (release = resolve));
      return Response.json(perDay, { status: 429 });
    };
    renderView(fetcher);
    await connect(user);
    await user.click(screen.getByRole("button", { name: "Bağlandı, devam et" }));
    await user.type(screen.getByLabelText("Planı sohbetle değiştir"), "2. günü müzesiz yap");
    const apply = screen.getByRole("button", { name: "Uygula" });
    await user.dblClick(apply);
    expect(await screen.findByRole("button", { name: "Düzenleniyor…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Yapay zekâyla planla" })).toBeDisabled();
    expect(posts).toBe(1);

    release();
    await screen.findByText("Hesabındaki kota ya da kredi bitmiş görünüyor. Sağlayıcının panelinden kontrol edebilirsin.");
    expect(screen.getByText("HTTP 429 · gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByLabelText("Planı sohbetle değiştir")).toHaveValue("2. günü müzesiz yap");
    expect(screen.getByRole("button", { name: "Uygula" })).toBeEnabled();
    expect(document.body.textContent).not.toContain(KEY);
  });

  it("deletes the key on request", async () => {
    const user = userEvent.setup();
    renderView(mockProvider("gemini", [], ["gemini-2.5-flash"]).fetcher);
    await connect(user);
    await user.click(screen.getByRole("button", { name: "Bağlandı, devam et" }));
    await user.click(screen.getByRole("button", { name: /Bağlantı ayarları/ }));
    await user.click(screen.getByRole("button", { name: "Anahtarı sil" }));
    await waitFor(() => expect(window.sessionStorage.getItem("va.ai.connection")).toBeNull());
    expect(screen.getByLabelText("API anahtarı")).toHaveValue("");
  });
});
