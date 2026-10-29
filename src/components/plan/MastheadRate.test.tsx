import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { chooseBudgetCurrency, resetPickedCurrency } from "@/components/budget/useBudgetCurrency";
import type { RateTable } from "@/lib/rates/types";
import { MastheadRate } from "./MastheadRate";

const tcmb = (tryPerUnit: number) => ({ tryPerUnit, sourceId: "tcmb" as const, sourceName: "TCMB", date: "2026-10-16" });
const rates: RateTable = { EUR: tcmb(55.618), USD: tcmb(49.4463), GBP: tcmb(66.0056), CZK: { ...tcmb(2.2481), sourceId: "frankfurter", sourceName: "Frankfurter (ECB)", date: "2026-10-15" } };

describe("MastheadRate", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/plan");
    window.localStorage.clear();
    resetPickedCurrency();
  });

  it("shows the lira rate with its source and date while the budget is in lira", () => {
    render(<MastheadRate local="EUR" rates={rates} fromLink={null} />);
    expect(screen.getByText("1 EUR = 55,62 ₺ · TCMB · 16 Eki")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("follows the budget's currency, and names both rates when they differ", () => {
    window.history.replaceState(null, "", "/plan?cur=USD");
    render(<MastheadRate local="CZK" rates={rates} fromLink="USD" />);
    expect(screen.getByText("100 CZK = 4,55 USD · Frankfurter (ECB) · 15 Eki; TCMB · 16 Eki")).toBeInTheDocument();
    act(() => chooseBudgetCurrency("EUR"));
    expect(screen.getByText("100 CZK = 4,04 EUR · Frankfurter (ECB) · 15 Eki; TCMB · 16 Eki")).toBeInTheDocument();
  });

  it("renders the link's currency on the server, before the remembered one applies", () => {
    window.localStorage.setItem("va.currency", "GBP");
    expect(renderToString(<MastheadRate local="CZK" rates={rates} fromLink="EUR" />)).toContain("100 CZK = 4,04 EUR");
    expect(renderToString(<MastheadRate local="CZK" rates={rates} fromLink={null} />)).toContain("1 CZK = 2,25 ₺");
  });

  it("is not shown when the budget is in the destination's own currency", () => {
    window.history.replaceState(null, "", "/plan?cur=EUR");
    const { container } = render(<MastheadRate local="EUR" rates={rates} fromLink="EUR" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("writes the lira rate when the chosen currency's rate is missing (the budget is in lira then)", () => {
    window.localStorage.setItem("va.currency", "GBP");
    render(<MastheadRate local="EUR" rates={{ EUR: rates.EUR }} fromLink={null} />);
    expect(screen.getByText("1 EUR = 55,62 ₺ · TCMB · 16 Eki")).toBeInTheDocument();
  });

  it("credits Exchange Rate API whenever its rate is shown", () => {
    render(<MastheadRate local="AED" rates={{ AED: { ...tcmb(13.53), sourceId: "erapi", sourceName: "Exchange Rate API" } }} fromLink={null} />);
    expect(screen.getByRole("link", { name: "Rates By Exchange Rate API" })).toHaveAttribute("href", "https://www.exchangerate-api.com");
  });

  it("says plainly when no rate was found", () => {
    render(<MastheadRate local="MVR" rates={{}} fromLink={null} />);
    expect(screen.getByText(/MVR kuru şu an alınamadı/)).toBeInTheDocument();
    expect(screen.queryByText(/₺/)).not.toBeInTheDocument();
  });
});
