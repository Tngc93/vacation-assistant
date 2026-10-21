import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { FlightLine, RateInfo } from "@/lib/budget/receipt";
import { BudgetReceipt } from "./BudgetReceipt";

const SEARCH = "from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2";
const flight: FlightLine = { kind: "ticket", label: "Wizz Air · W6 4402 · SAW → BCN", pricePerAdult: 4380, differentDates: false, sample: false, note: null };
const rate: RateInfo = { ok: true, currency: "EUR", tryPerUnit: 55.618, sourceId: "tcmb", sourceName: "TCMB", date: "2026-10-16" };
const empty = { flight: null, webFlight: null, stay: null, daily: null, cur: "TRY" };

function renderReceipt(props: Partial<Parameters<typeof BudgetReceipt>[0]> = {}) {
  return render(<BudgetReceipt initial={empty} flight={flight} rate={rate} localCurrency="EUR" nights={4} days={5} pax={2} {...props} />);
}
const receipt = () => screen.getByRole("region", { name: "Bütçe fişi" });
const row = (label: string) => within(receipt()).getByText(label).closest("div")!.parentElement!;

describe("BudgetReceipt", () => {
  beforeEach(() => window.history.replaceState(null, "", `/plan?${SEARCH}#butce`));

  it("starts empty: no example numbers, only the flight, and a partial total", () => {
    renderReceipt();
    for (const box of screen.getAllByRole("textbox")) {
      expect(box).toHaveValue("");
      expect(box).not.toHaveAttribute("placeholder");
    }
    expect(within(row("Uçuş")).getByText("8.760 ₺")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("girilmedi")).toBeInTheDocument();
    expect(within(row("Günlük harcama")).getByText("girilmedi")).toBeInTheDocument();
    expect(within(receipt()).getByText("KISMİ TOPLAM")).toBeInTheDocument();
    expect(within(receipt()).getByText("8.760 ₺", { selector: "[aria-live]" })).toBeInTheDocument();
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
    expect(within(receipt()).getByText("35.765 ₺")).toBeInTheDocument();
    expect(within(receipt()).getByText("17.883 ₺")).toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}&stay=3000&daily=1500.5`);
    expect(window.location.hash).toBe("#butce");
  });

  it("converts local-currency entries with the rate and names it", async () => {
    const user = userEvent.setup();
    renderReceipt();
    await user.click(screen.getByRole("button", { name: "EUR" }));
    await user.type(screen.getByLabelText("Gecelik konaklama (tüm odalar)"), "120");
    expect(within(row("Konaklama")).getByText("4 gece × 120 EUR = 480 EUR")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("26.697 ₺")).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("KUR: TCMB · 16 EKİ")).toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}&cur=EUR&stay=120`);
  });

  it("opens a shared link with the same budget", () => {
    renderReceipt({ initial: { flight: null, webFlight: null, stay: 12000, daily: 6000, cur: "EUR" } });
    expect(screen.getByLabelText("Gecelik konaklama (tüm odalar)")).toHaveValue("120");
    expect(screen.getByLabelText("Kişi başı günlük harcama")).toHaveValue("60");
    expect(screen.getByRole("button", { name: "EUR" })).toHaveAttribute("aria-pressed", "true");
    expect(within(row("Günlük harcama")).getByText("33.371 ₺")).toBeInTheDocument();
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
    expect(within(receipt()).getByText("22.000 ₺")).toBeInTheDocument();
  });

  it("warns when the local rate is missing and credits Exchange Rate API when it is the source", async () => {
    const user = userEvent.setup();
    const { unmount } = renderReceipt({ rate: { ok: false, currency: "EUR" }, initial: { ...empty, cur: "EUR", stay: 12000 } });
    expect(screen.getByText(/EUR kuru şu an alınamıyor/)).toBeInTheDocument();
    expect(within(row("Konaklama")).getByText("kur alınamadı")).toBeInTheDocument();
    unmount();
    renderReceipt({ rate: { ...rate, sourceId: "erapi", sourceName: "Exchange Rate API" }, initial: { ...empty, cur: "EUR" } });
    await user.type(screen.getByLabelText("Gecelik konaklama (tüm odalar)"), "100");
    expect(screen.getByRole("link", { name: "Rates By Exchange Rate API" })).toBeInTheDocument();
  });

  it("offers only lira for a lira destination", () => {
    renderReceipt({ localCurrency: "TRY", rate: null });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
