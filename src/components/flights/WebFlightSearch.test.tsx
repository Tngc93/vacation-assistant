import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveConnection } from "@/lib/ai/keyStore";
import { mockProvider } from "@/lib/ai/mockProvider";
import type { RateTable } from "@/lib/ai/webPrices";
import helpOnly429 from "@/lib/ai/__fixtures__/gemini-429-help-only.json";
import { WebFlightSearch } from "./WebFlightSearch";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const KEY = "test-key-not-real";
const query = { fromAirports: ["IST", "SAW"], toCity: "Barcelona", toAirports: ["BCN"], depart: "2026-11-14", return: "2026-11-18", adults: 2 };
const rates: RateTable = { EUR: { tryPerUnit: 40, sourceName: "TCMB", date: "2026-10-21" } };
const answer = {
  search: {
    text:
      "```json\n" +
      JSON.stringify({
        results: [
          { title: "Pegasus · IST → BCN", price: 9000, currency: "TRY", basis: "per_person", url: "https://www.flypgs.com/ist-bcn" },
          { title: "Vueling · SAW → BCN", price: 410, currency: "EUR", basis: "total", url: "https://www.vueling.com/x" },
          { title: "Made up", price: 10, currency: "TRY", basis: "per_person", url: "https://made-up.example/deal" },
        ],
      }) +
      "\n```",
    sources: [
      { url: "https://www.flypgs.com/ist-bcn", title: "Pegasus" },
      { url: "https://www.vueling.com/x", title: "Vueling" },
    ],
  },
};
const SUGGESTIONS =
  '<style>.chip{border:1px solid #ddd}</style><div class="container"><a class="chip" href="https://www.google.com/search?q=ist+bcn">ist bcn uçuş</a></div>';
const GROUNDED_TEXT = "Pegasus · IST → BCN: kişi başı 8.450 TL (flypgs.com)\nVueling · SAW → BCN: iki kişi toplam 410 EUR";
const grounded = {
  search: {
    text: GROUNDED_TEXT,
    sources: [
      { url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/A", title: "flypgs.com" },
      { url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/B", title: "vueling.com" },
    ],
    suggestionsHtml: SUGGESTIONS,
  },
};
const notFree = {
  status: 429,
  body: {
    error: {
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "0" }],
        },
      ],
    },
  },
};

const renderSearch = (fetcher?: typeof fetch, demo = false) =>
  render(<WebFlightSearch query={query} rates={rates} demo={demo} inBudget={null} fetcher={fetcher} />);

describe("flight prices from the model's web search", () => {
  beforeEach(() => window.history.replaceState(null, "", "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2"));
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    replace.mockClear();
  });

  it("without AI shows only one line, linking to the AI panel", () => {
    renderSearch(mockProvider("gemini", []).fetcher);
    const section = screen.getByRole("region", { name: "Web'de ara" });
    expect(section).toHaveTextContent("Güncel fiyatı web'de aratmak için yapay zekâ bağla");
    expect(within(section).getByRole("link", { name: "yapay zekâ bağla" })).toHaveAttribute("href", "#yapay-zeka");
    expect(within(section).queryByRole("button")).toBeNull();
  });

  it("searches only on click, shows linked prices as estimates apart from the cached ones, and caches the search", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "openai", key: KEY, model: "gpt-5-mini" }, false);
    const mock = mockProvider("openai", [answer, answer]);
    const view = renderSearch(mock.fetcher);
    expect(mock.requests).toHaveLength(0); // never on page load
    expect(screen.getByText(/Web araması kendi hesabından ücretlendirilebilir\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    // Cheapest first in lira: 410 EUR for 2 = 8.200 ₺ each, then 9.000 ₺.
    expect(within(cards[0]).getByText("8.200 ₺")).toBeInTheDocument();
    expect(within(cards[0]).getByText(/Sitedeki fiyat: 410 EUR · 2 yolcu toplam/)).toBeInTheDocument();
    expect(within(cards[0]).getByText("KUR: TCMB")).toBeInTheDocument();
    expect(within(cards[1]).getByText("9.000 ₺")).toBeInTheDocument();
    expect(screen.getAllByText("1 YETİŞKİN · TAHMİNİ")).toHaveLength(2);
    expect(screen.queryByText("EN UCUZ")).toBeNull();
    const link = within(cards[1]).getByRole("link", { name: /Sitede gör · flypgs\.com/ });
    // The page from the provider's own list, always visible and clickable.
    expect(link).toHaveAttribute("href", "https://www.flypgs.com/ist-bcn");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(screen.getByText(/Kaynağı aramada bulunan sayfalar arasında olmayan 1 sonuç gösterilmedi/)).toBeInTheDocument();
    // Provider and model names are upper-cased by English rules (CSS uppercase follows lang).
    const source = screen.getByText("OpenAI · gpt-5-mini");
    expect(source).toHaveAttribute("lang", "en");
    expect(source.parentElement).toHaveTextContent(/^YAPAY ZEKÂ WEB'DEN BULDU · SATIN ALMADAN ÖNCE DOĞRULA · OpenAI · gpt-5-mini · /);

    // The same search again (page reopened in this tab) comes from sessionStorage: no new request.
    view.unmount();
    renderSearch(mock.fetcher);
    expect(await screen.findAllByRole("article")).toHaveLength(2);
    expect(mock.requests.filter((r) => r.method === "POST")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Yeniden ara" }));
    await screen.findAllByRole("article");
    expect(mock.requests.filter((r) => r.method === "POST")).toHaveLength(2);

    // The key never shows up on the page.
    expect(document.body.innerHTML).not.toContain(KEY);
  });

  it("puts a web price in the budget instead of a cached ticket", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "anthropic", key: KEY, model: "claude-haiku-5-5" }, false);
    window.history.replaceState(null, "", "/plan?from=IST&to=BCN&flight=IST-LH1301-202611141905-202611180955");
    renderSearch(mockProvider("anthropic", [answer]).fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    const [cheapest] = await screen.findAllByRole("article");
    await user.click(within(cheapest).getByRole("button", { name: "Bütçeye ekle" }));
    expect(replace).toHaveBeenCalledWith("/plan?from=IST&to=BCN&wf=8200&wfs=vueling.com", { scroll: false });
  });

  it("locks the button while searching and shows errors calmly with the status and model", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "anthropic", key: KEY, model: "claude-haiku-5-5" }, false);
    let release: () => void = () => {};
    let posts = 0;
    const fetcher: typeof fetch = async () => {
      posts++;
      await new Promise<void>((resolve) => (release = resolve));
      return Response.json({ type: "error", error: { type: "invalid_request_error" } }, { status: 400 });
    };
    const logs = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
    renderSearch(fetcher);
    expect(screen.getByText(/Web araması kendi hesabından ücretlendirilebilir\./)).toBeInTheDocument();
    await user.dblClick(screen.getByRole("button", { name: "Web'de ara" }));
    expect(screen.getByRole("button", { name: "Web'de aranıyor…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Web'de aranıyor");
    expect(posts).toBe(1);
    release();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sağlayıcı bu isteği kabul etmedi.");
    expect(screen.getByText("HTTP 400 · CLAUDE-HAIKU-5-5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Web'de ara" })).toBeEnabled();
    expect(document.body.textContent).not.toContain(KEY);
    // Nothing about the call is logged, least of all the key.
    for (const spy of logs) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(KEY);
      spy.mockRestore();
    }
  });

  it("labels the keyless demo's answers as sample data", async () => {
    const user = userEvent.setup();
    renderSearch(undefined, true);
    expect(screen.getByText("Örnek sağlayıcı: arama yapılmaz, ücret yok.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    expect(await screen.findByText("ÖRNEK VERİ · ÖRNEK SAĞLAYICI · GERÇEK FİYAT DEĞİL")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("says so when no price could be linked to a page", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "openai", key: KEY, model: "gpt-5-mini" }, false);
    renderSearch(mockProvider("openai", [{ search: { text: '```json\n{"results":[]}\n```', sources: [] } }]).fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    expect(await screen.findByText("Web'de doğrulanabilir bir fiyat bulunamadı.")).toBeInTheDocument();
  });
});

describe("Gemini: the grounded answer as it came", () => {
  beforeEach(() => window.history.replaceState(null, "", "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2"));
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("shows the text unchanged with Google's links and Search Suggestions; no prices, budget button or cache", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-2.5-flash" }, false);
    const mock = mockProvider("gemini", [grounded]);
    const view = renderSearch(mock.fetcher);
    expect(screen.getByText(/Ücretsiz katmanda günlük arama sınırı var\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    const text = await screen.findByTestId("grounded-text");
    expect(text.textContent).toBe(GROUNDED_TEXT);
    const block = screen.getByTestId("grounded-result");
    const links = within(block).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("rel")])).toEqual([
      ["flypgs.com", "https://vertexaisearch.cloud.google.com/grounding-api-redirect/A", "noopener noreferrer nofollow"],
      ["vueling.com", "https://vertexaisearch.cloud.google.com/grounding-api-redirect/B", "noopener noreferrer nofollow"],
    ]);
    // The Search Suggestions, exactly as Google sent them, in a shadow root (not a frame).
    expect(screen.getByTestId("search-suggestions").shadowRoot?.innerHTML).toBe(SUGGESTIONS);
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByText("Fiyatı doğruladıktan sonra bütçeye kendin yazabilirsin.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bütçeye ekle" })).toBeNull();
    expect(screen.queryByText(/TAHMİNİ/)).toBeNull();
    // Nothing is stored: opened again, the answer is gone and must be searched again.
    expect(Object.keys(window.sessionStorage).filter((k) => k.startsWith("va.web."))).toEqual([]);
    view.unmount();
    renderSearch(mock.fetcher);
    expect(screen.queryByTestId("grounded-result")).toBeNull();
    expect(screen.getByRole("button", { name: "Web'de ara" })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(KEY);
  });

  it("does not insert Search Suggestions that could run anything; shows the queries as plain text instead", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-2.5-flash" }, false);
    const unsafe = { search: { ...grounded.search, suggestionsHtml: '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a>' } };
    renderSearch(mockProvider("gemini", [unsafe]).fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    await screen.findByTestId("grounded-text");
    expect(screen.queryByTestId("search-suggestions")).toBeNull();
    expect(screen.getByText("Google araması: prices")).toBeInTheDocument();
  });

  it("offers this one search with Gemini 2.5 Flash when the model has no free-tier search, keeping the connection's model", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-3.6-flash" }, false);
    const mock = mockProvider("gemini", [notFree, grounded], ["gemini-3.6-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"]);
    renderSearch(mock.fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bu model ücretsiz katmanda kullanılamıyor.");
    await user.click(await screen.findByRole("button", { name: "Gemini 2.5 Flash ile ara" }));
    expect((await screen.findByTestId("grounded-text")).textContent).toBe(GROUNDED_TEXT);
    expect(mock.requests.filter((r) => r.method === "POST").map((r) => r.url)).toEqual([
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    ]);
    expect(screen.getByText("Google Gemini · gemini-2.5-flash")).toHaveAttribute("lang", "en");
    expect(JSON.parse(window.sessionStorage.getItem("va.ai.connection")!).model).toBe("gemini-3.6-flash");
  });

  it("shows no 2.5 Flash button when the key's model list has none", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-3.6-flash" }, false);
    const mock = mockProvider("gemini", [notFree], ["gemini-3.6-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]);
    renderSearch(mock.fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    await screen.findByRole("alert");
    // The model list was asked for after the error, and had no 2.5 Flash.
    await waitFor(() => expect(mock.requests.filter((r) => r.method === "GET")).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Web'de ara" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Gemini 2.5 Flash ile ara" })).toBeNull();
  });
});

describe("Gemini: a 429 that says neither which quota nor how long to wait", () => {
  const bare = { status: 429, body: helpOnly429 };
  beforeEach(() => window.history.replaceState(null, "", "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2"));
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("on a Gemini 3 search, says Gemini 3 has no free-tier search and offers 2.5 Flash from the list", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-3.6-flash" }, false);
    const mock = mockProvider("gemini", [bare, grounded], ["gemini-3.6-flash", "gemini-2.5-flash"]);
    renderSearch(mock.fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Google bu aramaya kota sınırı uyguladı. Gemini 3 modelleri ücretsiz katmanda web araması yapamıyor.");
    expect(alert).toHaveTextContent("HTTP 429 · GEMINI-3.6-FLASH");
    expect(alert).not.toHaveTextContent(/exceeded|quota, please/);
    await user.click(await screen.findByRole("button", { name: "Gemini 2.5 Flash ile ara" }));
    expect((await screen.findByTestId("grounded-text")).textContent).toBe(GROUNDED_TEXT);
    expect(mock.requests.filter((r) => r.method === "POST")).toHaveLength(2); // no automatic retry
  });

  it("keeps the same message without a button when the list has no 2.5 Flash", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-3.6-flash" }, false);
    const mock = mockProvider("gemini", [bare], ["gemini-3.6-flash", "gemini-2.5-pro"]);
    renderSearch(mock.fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gemini 3 modelleri ücretsiz katmanda web araması yapamıyor.");
    await waitFor(() => expect(mock.requests.filter((r) => r.method === "GET")).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Web'de ara" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Gemini 2.5 Flash ile ara" })).toBeNull();
  });

  it("on a search already with a 2.5 model, says the limit was not named, with no button and no retry", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-2.5-flash" }, false);
    const mock = mockProvider("gemini", [bare, grounded], ["gemini-2.5-flash"]);
    renderSearch(mock.fetcher);
    await user.click(screen.getByRole("button", { name: "Web'de ara" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google kota sınırına takıldığını söylüyor ama hangi sınır olduğunu belirtmedi. Bir dakika bekleyip yeniden dene; tekrarlarsa ai.dev/rate-limit sayfasından kullanımına bak.",
    );
    expect(screen.queryByRole("button", { name: "Gemini 2.5 Flash ile ara" })).toBeNull();
    expect(mock.requests.filter((r) => r.method === "POST")).toHaveLength(1);
    expect(mock.requests.filter((r) => r.method === "GET")).toHaveLength(0);
  });
});
