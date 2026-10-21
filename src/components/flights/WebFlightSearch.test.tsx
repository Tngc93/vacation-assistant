import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveConnection } from "@/lib/ai/keyStore";
import { mockProvider } from "@/lib/ai/mockProvider";
import type { RateTable } from "@/lib/ai/webPrices";
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
      { url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/A", title: "flypgs.com" },
      { url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/B", title: "vueling.com" },
    ],
    suggestionsHtml: '<div class="container"><a class="chip" href="https://www.google.com/search?q=ist+bcn">ist bcn uçuş</a></div>',
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
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-2.5-flash" }, false);
    const mock = mockProvider("gemini", [answer, answer]);
    const view = renderSearch(mock.fetcher);
    expect(mock.requests).toHaveLength(0); // never on page load
    expect(screen.getByText(/Ücretsiz katmanda günlük arama sınırı var\./)).toBeInTheDocument();

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
    expect(link).toHaveAttribute("href", "https://vertexaisearch.cloud.google.com/grounding-api-redirect/A");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(screen.getByText(/Kaynağı aramada bulunan sayfalar arasında olmayan 1 sonuç gösterilmedi/)).toBeInTheDocument();
    expect(screen.getByText(/YAPAY ZEKÂ WEB'DEN BULDU · SATIN ALMADAN ÖNCE DOĞRULA · Google Gemini · gemini-2\.5-flash · /)).toBeInTheDocument();
    // Gemini's Search Suggestions, unmodified, in a sandboxed frame.
    const frame = screen.getByTitle("Google arama önerileri");
    expect(frame.getAttribute("srcdoc")).toContain(answer.search.suggestionsHtml);
    expect(frame).toHaveAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox allow-same-origin");

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
    saveConnection({ provider: "gemini", key: KEY, model: "gemini-2.5-flash" }, false);
    window.history.replaceState(null, "", "/plan?from=IST&to=BCN&flight=IST-LH1301-202611141905-202611180955");
    renderSearch(mockProvider("gemini", [answer]).fetcher);
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
    expect(screen.getByText("HTTP 400 · claude-haiku-5-5")).toBeInTheDocument();
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
