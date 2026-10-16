import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SOURCES } from "@/lib/rates";
import { RateText } from "./RateLine";

describe("RateText", () => {
  it("shows the rate with its source and date", () => {
    render(<RateText rate={{ ok: true, currency: "EUR", tryPerUnit: 38.42, source: SOURCES.tcmb, date: "2026-10-16" }} />);
    expect(screen.getByText("1 EUR = 38,42 ₺ · TCMB · 16 Eki")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("credits Exchange Rate API whenever its rate is shown", () => {
    render(<RateText rate={{ ok: true, currency: "AED", tryPerUnit: 13.53, source: SOURCES.erapi, date: "2026-10-16" }} />);
    const credit = screen.getByRole("link", { name: "Rates By Exchange Rate API" });
    expect(credit).toHaveAttribute("href", "https://www.exchangerate-api.com");
  });

  it("says plainly when no rate was found", () => {
    render(<RateText rate={{ ok: false, currency: "MVR", attempts: [] }} />);
    expect(screen.getByText(/MVR kuru şu an alınamadı/)).toBeInTheDocument();
    expect(screen.queryByText(/₺/)).not.toBeInTheDocument();
  });
});
