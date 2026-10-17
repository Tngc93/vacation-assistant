import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import { StayCard } from "./StayCard";

const barcelona = findDestination("BCN")!;

describe("StayCard", () => {
  it("shows no price of its own and links to prefilled hotel searches", () => {
    render(<StayCard destination={barcelona} checkIn="2026-11-14" checkOut="2026-11-18" adults={2} />);
    expect(screen.getByText("4 GECE · 14 KAS CMT → 18 KAS ÇAR · 2 KİŞİ")).toBeInTheDocument();
    expect(screen.queryByText(/₺/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Booking/ }).getAttribute("href")).toContain("checkin=2026-11-14&checkout=2026-11-18&group_adults=2");
    expect(screen.getByRole("link", { name: /Google Hotels/ }).getAttribute("href")).toContain("from+2026-11-14+to+2026-11-18");
    expect(screen.queryByText(/kişi sayısını linkten almıyor/)).not.toBeInTheDocument();
  });

  it("says Google Hotels needs the guest count chosen there when it is not two", () => {
    render(<StayCard destination={barcelona} checkIn="2026-11-14" checkOut="2026-11-18" adults={3} />);
    expect(screen.getByText(/3 kişi için orada seçmen gerekiyor/)).toBeInTheDocument();
  });
});
