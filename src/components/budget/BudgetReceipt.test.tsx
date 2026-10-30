import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { en } from "@/i18n/messages/en";
import { CURRENCY_STORAGE_KEY } from "@/lib/budget/currency";
import type { FlightLine } from "@/lib/budget/receipt";
import { BUDGET_FLIGHT_DROPPED_EVENT, BUDGET_STAY_EVENT } from "@/lib/budget/params";
import type { RateTable } from "@/lib/rates/types";
import { BudgetCurrencyPicker } from "./BudgetCurrencyPicker";
import { BudgetReceipt } from "./BudgetReceipt";
import { resetPickedCurrency } from "./useBudgetCurrency";

const SEARCH = "from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2";
const flight: FlightLine = { kind: "ticket", label: "Wizz Air · W6 4402 · SAW → BCN", pricePerAdult: 4380, differentDates: false, sample: false, note: null };
const tcmb = (tryPerUnit: number) => ({ tryPerUnit, sourceId: "tcmb" as const, sourceName: "TCMB", date: "2026-10-16" });
const rates: RateTable = { EUR: tcmb(55.618), USD: tcmb(49.4463), GBP: tcmb(66.0056) };
const empty = { flight: null, webFlight: null, stay: null, daily: null, cur: "TRY" };

type Props = Parameters<typeof BudgetReceipt>[0];
function renderReceipt(props: Partial<Props> = {}) {
  const all: Props = { initial: empty, flight, rates, nights: 4, days: 5, pax: 2, ...props };
  return render(
    <>
      <BudgetCurrencyPicker fromLink={null} />
      <BudgetReceipt {...all} />
    </>,
  );
}
const receipt = () => screen.getByRole("region", { name: "Bütçe fişi" });
// A receipt line is one <dt>/<dd> group in the <dl>.
const row = (label: string) => within(receipt()).getByText(label).closest("dt")!.parentElement!;
const total = () => within(receipt()).getByText(/./, { selector: "[aria-live]" });
const param = (key: string) => new URLSearchParams(window.location.search).get(key);

describe("BudgetReceipt", () => {
  beforeEach(() => window.history.replaceState(null, "", `/plan?${SEARCH}#butce`));
  afterEach(() => {
    window.localStorage.clear();
    resetPickedCurrency();
    vi.restoreAllMocks();
  });

  it("starts empty in lira: no example numbers, only the flight, and a partial total", () => {
    renderReceipt();
    for (const box of screen.getAllByRole("textbox")) {
      expect(box).toHaveValue("");
      expect(box).not.toHaveAttribute("placeholder");
    }
    expect(screen.getByRole("button", { name: "TL" })).toHaveAttribute("aria-pressed", "true");
    expect(within(receipt()).getByText("BÜTÇE FİŞİ · TL")).toBeInTheDocument();
    expect(within(row("Uçuş")).getByText("8.760 ₺")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("girilmedi")).toBeInTheDocument();
    expect(within(row("Günlük harcama")).getByText("girilmedi")).toBeInTheDocument();
    expect(within(receipt()).getByText("KISMİ TOPLAM")).toBeInTheDocument();
    expect(total()).toHaveTextContent("8.760 ₺");
    // Nothing was converted: no rate line.
    expect(within(receipt()).queryByText(/^Kur:/)).not.toBeInTheDocument();
  });

  it("adds what is typed, shows each row's source and keeps the link in step", async () => {
    const user = userEvent.setup();
    renderReceipt();
    await user.type(screen.getByLabelText("Gecelik konaklama (tüm odalar)"), "3000");
    await user.type(screen.getByLabelText("Kişi başı günlük harcama"), "1500,5");
    expect(within(row("Konaklama")).getByText("12.000 ₺")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("4 gece × 3.000 ₺")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("SENİN GİRDİĞİN · TAHMİNİ")).toBeInTheDocument();
    // 5 × 2 × 1500,50 = 15.005 ₺
    expect(within(row("Günlük harcama")).getByText("15.005 ₺")).toBeInTheDocument();
    expect(within(row("Uçuş")).getByText("TRAVELPAYOUTS · ÖNBELLEKTEN · TAHMİNİ")).toBeInTheDocument();
    expect(within(receipt()).queryByText("KISMİ TOPLAM")).not.toBeInTheDocument();
    expect(total()).toHaveTextContent("35.765 ₺");
    expect(within(receipt()).getByText("17.883 ₺")).toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}&stay=3000&daily=1500.5`);
    expect(window.location.hash).toBe("#butce");
  });

  it("shows everything in the chosen currency, converts what was entered, remembers the choice and names the rate", async () => {
    const user = userEvent.setup();
    renderReceipt();
    await user.type(screen.getByLabelText("Gecelik konaklama (tüm odalar)"), "3000");
    await user.click(screen.getByRole("button", { name: "EUR" }));

    expect(screen.getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
    expect(within(receipt()).getByText("BÜTÇE FİŞİ · EUR")).toBeInTheDocument();
    // 3.000 ₺ ÷ 55,618 = 53,94 EUR, kept with its cents in the field and in the link.
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("53,94");
    expect(within(row("Konaklama")).getByText("4 gece × €53,94")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("€216")).toBeInTheDocument();
    // The flight came in lira: its detail keeps the lira price, its amount is in euro (8.760 ₺ = 157,50 € → €158).
    expect(within(row("Uçuş")).getByText("2 yolcu × 4.380 ₺ · Wizz Air · W6 4402 · SAW → BCN")).toBeInTheDocument();
    expect(within(row("Uçuş")).getByText("€158")).toBeInTheDocument();
    expect(total()).toHaveTextContent("€374");
    expect(within(receipt()).getByText("Kur: TCMB · 16 Eki")).toBeInTheDocument();
    expect(param("cur")).toBe("EUR");
    expect(param("stay")).toBe("53.94");
    expect(window.localStorage.getItem(CURRENCY_STORAGE_KEY)).toBe("EUR");

    // Back to lira: exactly what was typed, not 3.000,03 from two roundings.
    await user.click(screen.getByRole("button", { name: "TL" }));
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("3000");
    expect(param("cur")).toBeNull();
    expect(param("stay")).toBe("3000");
    // Stored too: the English pages default to EUR, so a chosen TRY must be remembered.
    expect(window.localStorage.getItem(CURRENCY_STORAGE_KEY)).toBe("TRY");
  });

  it("converts between two foreign currencies through lira", async () => {
    const user = userEvent.setup();
    renderReceipt({ initial: { ...empty, stay: 12000, cur: "EUR" } });
    await user.click(screen.getByRole("button", { name: "USD" }));
    // 120 EUR × 55,618 ÷ 49,4463 = 134,98 USD
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("134,98");
    expect(within(row("Uçuş")).getByText("$177")).toBeInTheDocument();
    expect(param("cur")).toBe("USD");
    expect(param("stay")).toBe("134.98");
  });

  it("opens a shared link with the same budget, in its currency", () => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, "GBP");
    window.history.replaceState(null, "", `/plan?${SEARCH}&cur=EUR&stay=120&daily=60`);
    renderReceipt({ initial: { flight: null, webFlight: null, stay: 12000, daily: 6000, cur: "EUR" } });
    // The link's currency wins over the visitor's last choice.
    expect(screen.getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("120");
    expect(screen.getByLabelText("Kişi başı günlük harcama")).toHaveValue("60");
    expect(within(row("Konaklama")).getByText("€480")).toBeInTheDocument();
    expect(within(row("Günlük harcama")).getByText("€600")).toBeInTheDocument();
  });

  it("opens an older lira link in the remembered currency, converting its amounts", () => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, "EUR");
    window.history.replaceState(null, "", `/plan?${SEARCH}&stay=3000`);
    renderReceipt({ initial: { ...empty, stay: 300000 } });
    expect(screen.getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("53,94");
    expect(param("cur")).toBe("EUR");
    expect(param("stay")).toBe("53.94");
  });

  it("converts an older link's destination-currency amounts (cur=CZK) instead of misreading them", () => {
    window.history.replaceState(null, "", `/plan?${SEARCH}&cur=CZK&stay=3000`);
    renderReceipt({ initial: { ...empty, stay: 300000, cur: "CZK" }, rates: { ...rates, CZK: tcmb(2.2481) } });
    // 3.000 CZK × 2,2481 = 6.744,30 ₺
    expect(screen.getByRole("button", { name: "TL" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("6744,3");
    expect(param("cur")).toBeNull();
    expect(param("stay")).toBe("6744.3");
  });

  it("falls back to the default when storage cannot be read, and still switches", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();
    renderReceipt();
    expect(screen.getByRole("button", { name: "TL" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "GBP" }));
    expect(screen.getByRole("button", { name: "GBP" })).toHaveAttribute("aria-pressed", "true");
    expect(within(row("Uçuş")).getByText("£133")).toBeInTheDocument();
    expect(param("cur")).toBe("GBP");
  });

  it("stays in lira and says so when the chosen currency's rate is missing; never a guessed rate", async () => {
    const user = userEvent.setup();
    renderReceipt({ rates: { EUR: rates.EUR } });
    await user.click(screen.getByRole("button", { name: "USD" }));
    expect(within(receipt()).getByText("USD kuru şu an alınamadı; bütçe TL olarak gösteriliyor.")).toBeInTheDocument();
    expect(within(receipt()).getByText("BÜTÇE FİŞİ · TL")).toBeInTheDocument();
    expect(total()).toHaveTextContent("8.760 ₺");
    expect(param("cur")).toBeNull();
  });

  it("keeps amounts it cannot convert, out of the total, with their currency", () => {
    window.history.replaceState(null, "", `/plan?${SEARCH}&cur=EUR&stay=120`);
    renderReceipt({ rates: {}, initial: { ...empty, cur: "EUR", stay: 12000 } });
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("120");
    expect(within(row("Konaklama")).getByText("kur alınamadı")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("EUR KURU ALINAMADI · TOPLAMA EKLENMEDİ")).toBeInTheDocument();
    expect(total()).toHaveTextContent("8.760 ₺");
    // The link is left as it was.
    expect(param("cur")).toBe("EUR");
    expect(param("stay")).toBe("120");
  });

  it("credits Exchange Rate API when its rate is used", async () => {
    const user = userEvent.setup();
    renderReceipt({ rates: { ...rates, GBP: { ...rates.GBP, sourceId: "erapi", sourceName: "Exchange Rate API" } } });
    await user.click(screen.getByRole("button", { name: "GBP" }));
    expect(within(receipt()).getByText("Kur: Exchange Rate API · 16 Eki")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rates By Exchange Rate API" })).toBeInTheDocument();
  });

  it("explains a bad amount and keeps it out of the link and the total", async () => {
    const user = userEvent.setup();
    renderReceipt();
    const box = screen.getByLabelText("Gecelik konaklama (tüm odalar)");
    await user.type(box, "1.250,50");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Yalnızca rakam ve en fazla iki ondalık/)).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("girilmedi")).toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}`);
    await user.clear(box);
    expect(box).not.toHaveAttribute("aria-invalid");
  });

  it("says there is no flight price and leaves it out", () => {
    renderReceipt({ flight: { kind: "missing", reason: "SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK" }, initial: { ...empty, stay: 300000, daily: 100000 } });
    expect(within(row("Uçuş")).getByText("uçuş fiyatı yok")).toBeInTheDocument();
    expect(within(row("Uçuş")).getByText("SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK")).toBeInTheDocument();
    expect(within(receipt()).getByText("KISMİ TOPLAM")).toBeInTheDocument();
    expect(total()).toHaveTextContent("22.000 ₺");
  });

  it("takes a nightly price from the web search in its currency, converted to the field's", async () => {
    const user = userEvent.setup();
    renderReceipt();
    await user.click(screen.getByRole("button", { name: "EUR" }));
    const event = new CustomEvent(BUDGET_STAY_EVENT, { detail: { minor: 600000, currency: "TRY" }, cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    // 6.000 ₺ ÷ 55,618 = 107,88 EUR
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("107,88");
    expect(param("stay")).toBe("107.88");
  });

  it("says once, calmly, that a new origin took the chosen flight out, until another flight is chosen", () => {
    const view = renderReceipt();
    expect(screen.queryByText("Kalkış değişti; seçili uçuş bütçeden çıkarıldı.")).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event(BUDGET_FLIGHT_DROPPED_EVENT));
    });
    expect(within(receipt()).getByRole("status")).toHaveTextContent("Kalkış değişti; seçili uçuş bütçeden çıkarıldı.");
    // A ticket chosen again (`?flight=` back in the link): the note goes.
    view.rerender(
      <BudgetReceipt initial={{ ...empty, flight: "ESB-PC1234-202611140705-202611181010" }} flight={flight} rates={rates} nights={4} days={5} pax={2} />,
    );
    expect(screen.queryByText("Kalkış değişti; seçili uçuş bütçeden çıkarıldı.")).not.toBeInTheDocument();
  });
});

describe("BudgetReceipt in English", () => {
  beforeEach(() => window.history.replaceState(null, "", `/en/plan?${SEARCH}#butce`));
  afterEach(() => {
    window.localStorage.clear();
    resetPickedCurrency();
  });

  const renderEnglish = () =>
    render(
      <I18nProvider locale="en" messages={en}>
        <BudgetCurrencyPicker fromLink={null} />
        <BudgetReceipt initial={empty} flight={flight} rates={rates} nights={4} days={5} pax={2} />
      </I18nProvider>,
    );

  it("defaults to EUR, words the receipt in English and formats with Intl (en-GB)", () => {
    renderEnglish();
    // The language's default is not written to the link.
    expect(param("cur")).toBeNull();
    const english = screen.getByRole("region", { name: "Budget receipt" });
    expect(within(english).getByText("BUDGET RECEIPT · EUR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
    // 2 × 4.380 ₺ = 8.760 ₺ at 55,618 ₺/EUR.
    expect(within(english).getByText("€158", { selector: "[aria-live]" })).toBeInTheDocument();
    expect(screen.getByLabelText("Stay per night (all rooms)")).toBeInTheDocument();
  });

  it("writes ?cur= once the picker is used, or when amounts need it", async () => {
    const user = userEvent.setup();
    renderEnglish();
    await user.click(screen.getByRole("button", { name: "USD" }));
    expect(param("cur")).toBe("USD");
  });

  it("labels typed amounts with the default currency, without the picker", async () => {
    const user = userEvent.setup();
    renderEnglish();
    expect(param("cur")).toBeNull();
    await user.type(screen.getByLabelText("Stay per night (all rooms)"), "120");
    expect(param("stay")).toBe("120");
    expect(param("cur")).toBe("EUR");
  });

  it("lets the link's ?cur= and the visitor's own choice come before the default", () => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, "TRY");
    renderEnglish();
    expect(within(screen.getByRole("region", { name: "Budget receipt" })).getByText("BUDGET RECEIPT · TRY")).toBeInTheDocument();
  });
});
