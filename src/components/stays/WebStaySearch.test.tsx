import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BudgetReceipt } from "@/components/budget/BudgetReceipt";
import { saveConnection } from "@/lib/ai/keyStore";
import { mockProvider } from "@/lib/ai/mockProvider";
import type { RateTable } from "@/lib/ai/webPrices";
import { WebStaySearch } from "./WebStaySearch";

const KEY = "test-key-not-real";
const query = { city: "Barcelona", country: "ES", checkIn: "2026-11-14", checkOut: "2026-11-18", adults: 2 };
const rates: RateTable = { EUR: { tryPerUnit: 40, sourceId: "tcmb", sourceName: "TCMB", date: "2026-10-21" } };
const answer = {
  search: {
    text: JSON.stringify({
      areas: [
        { name: "Eixample", min: 120, max: 180, currency: "EUR", basis: "per_night", url: "https://www.booking.com/eixample" },
        { name: "Gràcia", min: 3000, max: 4000, currency: "TRY", basis: "per_night", url: "https://www.example.com/gracia" },
        { name: "Uydurma", min: 1, max: 2, currency: "TRY", basis: "per_night", url: "https://nowhere.example/x" },
      ],
    }),
    sources: [
      { url: "https://www.booking.com/eixample", title: "Booking" },
      { url: "https://www.example.com/gracia", title: "Example" },
    ],
  },
};

describe("stay prices by neighbourhood", () => {
  beforeEach(() => window.history.replaceState(null, "", "/plan?from=IST&to=BCN&pax=2"));
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("shows nothing without AI: the card stays as it is", () => {
    const { container } = render(<WebStaySearch query={query} rates={rates} demo={false} fetcher={mockProvider("gemini", []).fetcher} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("finds ranges with links, and writes the middle into the budget's nightly field", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "anthropic", key: KEY, model: "claude-haiku-5-5" }, false);
    const mock = mockProvider("anthropic", [answer]);
    render(
      <>
        <WebStaySearch query={query} rates={rates} demo={false} fetcher={mock.fetcher} />
        <BudgetReceipt
          initial={{ flight: null, webFlight: null, stay: null, daily: null, cur: "TRY" }}
          flight={{ kind: "missing", reason: "YOK" }}
          rates={rates}
          nights={4}
          days={5}
          pax={2}
        />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Semte göre fiyat aralığını web'de ara" }));
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Eixample");
    expect(rows[0]).toHaveTextContent("4.800 ₺ – 7.200 ₺");
    expect(rows[0]).toHaveTextContent("SİTEDE 120 EUR – 180 EUR · KUR: TCMB · TAHMİNİ");
    expect(within(rows[0]).getByRole("link", { name: /Kaynak: booking\.com/ })).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(rows[1]).toHaveTextContent("3.000 ₺ – 4.000 ₺");

    await user.click(within(rows[0]).getByRole("button", { name: "Bütçeye yaz" }));
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("6000");
    expect(new URLSearchParams(window.location.search).get("stay")).toBe("6000");
    // 4 nights × 6.000 ₺ in the receipt; the person can still change it.
    const receipt = screen.getByRole("region", { name: "Bütçe fişi" });
    expect(within(receipt).getByText("4 gece × 6.000 ₺")).toBeInTheDocument();
    expect(within(receipt).getAllByText("24.000 ₺")).toHaveLength(2); // the row and the total
    expect(screen.getByText(/Eixample: gecelik 6\.000 ₺ bütçeye yazıldı/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(KEY);
  });

  it("shows the ranges in the budget's currency and writes the middle in it", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "anthropic", key: KEY, model: "claude-haiku-5-5" }, false);
    window.history.replaceState(null, "", "/plan?from=IST&to=BCN&pax=2&cur=EUR");
    const mock = mockProvider("anthropic", [answer]);
    render(
      <>
        <WebStaySearch query={query} rates={rates} demo={false} fetcher={mock.fetcher} />
        <BudgetReceipt
          initial={{ flight: null, webFlight: null, stay: null, daily: null, cur: "EUR" }}
          flight={{ kind: "missing", reason: "YOK" }}
          rates={rates}
          nights={4}
          days={5}
          pax={2}
        />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Semte göre fiyat aralığını web'de ara" }));
    const rows = await screen.findAllByRole("listitem");
    const eur = (value: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
    // In its own currency: as the site said, no rate.
    expect(rows[0]).toHaveTextContent(`${eur(120)} – ${eur(180)}`);
    expect(rows[0]).not.toHaveTextContent("SİTEDE");
    // 3.000–4.000 ₺ ÷ 40 = 75–100 EUR, with the rate's source.
    expect(rows[1]).toHaveTextContent(`${eur(75)} – ${eur(100)}`);
    expect(rows[1]).toHaveTextContent("SİTEDE 3.000 ₺ – 4.000 ₺ · KUR: TCMB · TAHMİNİ");

    await user.click(within(rows[0]).getByRole("button", { name: "Bütçeye yaz" }));
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("150");
    expect(new URLSearchParams(window.location.search).get("stay")).toBe("150");
    expect(new URLSearchParams(window.location.search).get("cur")).toBe("EUR");
    expect(screen.getByText(new RegExp(`Eixample: gecelik ${eur(150)} bütçeye yazıldı`))).toBeInTheDocument();
  });

  it("says so when the budget cannot take the price", async () => {
    const user = userEvent.setup();
    saveConnection({ provider: "anthropic", key: KEY, model: "claude-haiku-5-5" }, false);
    render(<WebStaySearch query={query} rates={rates} demo={false} fetcher={mockProvider("anthropic", [answer]).fetcher} />);
    await user.click(screen.getByRole("button", { name: "Semte göre fiyat aralığını web'de ara" }));
    const rows = await screen.findAllByRole("listitem");
    await user.click(within(rows[0]).getByRole("button", { name: "Bütçeye yaz" }));
    expect(screen.getByText(/Bütçe şu an bu tutarı alamadı/)).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("stay")).toBeNull();
  });
});
