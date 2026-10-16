import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { findDestination, type Destination } from "@/data/destinations";
import { MFA_VISA_URL } from "@/lib/visa";
import { VisaCard } from "./VisaCard";

describe("VisaCard", () => {
  it("shows the stamp, passport type, data date and the official link", () => {
    render(<VisaCard destination={findDestination("SJJ")!} />);
    expect(screen.getByRole("img", { name: "Vizesiz, 90 gün" })).toBeInTheDocument();
    expect(screen.getByText("Bosna-Hersek için 90 güne kadar vize gerekmiyor.")).toBeInTheDocument();
    expect(screen.getByText(/Bordo \(umuma mahsus\) pasaport · Veri: 18 Şub 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Yeşil \(hususi\), gri \(hizmet\) ve diplomatik pasaportlarda/)).toBeInTheDocument();
    const official = screen.getByRole("link", { name: /Resmî bilgi: T\.C\. Dışişleri Bakanlığı/ });
    expect(official).toHaveAttribute("href", MFA_VISA_URL);
    expect(official).toHaveAttribute("target", "_blank");
    expect(official).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: "Passport Index Data" })).toBeInTheDocument();
  });

  it("uses the warning tone when a visa is needed", () => {
    render(<VisaCard destination={findDestination("PAR")!} />);
    expect(screen.getByRole("img", { name: "Vize gerekli" }).className).toContain("text-warn");
  });

  it("says unknown and still points to the official page when the country is missing", () => {
    const nowhere: Destination = { ...findDestination("PAR")!, countryCode: "ZZ", countryTr: "Bilinmeyen Ülke" };
    render(<VisaCard destination={nowhere} />);
    expect(screen.getByRole("img", { name: "Bilinmiyor" }).className).toContain("text-ink-muted");
    expect(screen.getByText(/resmî sayfadan kontrol et/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dışişleri Bakanlığı/ })).toHaveAttribute("href", MFA_VISA_URL);
  });
});
