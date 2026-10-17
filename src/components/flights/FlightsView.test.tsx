import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/data/origins";
import { ESB_AMS_NOVEMBER as esbMonth } from "@/lib/flights/__fixtures__/samples";
import { IST_BCN as ist } from "@/lib/flights/__fixtures__/samples";
import { SAW_BCN as saw } from "@/lib/flights/__fixtures__/samples";
import type { Fetcher } from "@/lib/flights/client";
import { searchFlights, type FlightsResult, type FlightsSearch } from "@/lib/flights/search";
import { FlightsView } from "./FlightsSection";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const istanbul: FlightsSearch = {
  origin: findOrigin("IST")!,
  destination: findDestination("BCN")!,
  depart: "2026-11-14",
  return: "2026-11-18",
  pax: 2,
  direct: false,
  today: "2026-10-17",
};

const fetcher = (map: Record<string, unknown[]>): Fetcher =>
  async (url) => {
    const p = new URL(url).searchParams;
    return Response.json({ success: true, data: map[`${p.get("origin")}-${p.get("departure_at")}`] ?? [], error: null });
  };

async function resultFor(search: FlightsSearch, map: Record<string, unknown[]>): Promise<FlightsResult> {
  return searchFlights(search, { fetcher: fetcher(map), token: "t", partner: { marker: "4242", trs: null }, fixture: false });
}

describe("FlightsView", () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState(null, "", "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2");
  });

  it("groups tickets by airport with codes, times, stops, airline and prices", async () => {
    render(<FlightsView result={await resultFor(istanbul, { "IST-2026-11-14": ist.data, "SAW-2026-11-14": saw.data })} />);
    const istGroup = screen.getByRole("heading", { name: "İstanbul Havalimanı" }).closest("section")!;
    const sawGroup = screen.getByRole("heading", { name: "Sabiha Gökçen" }).closest("section")!;
    expect(within(istGroup).getAllByRole("article")).toHaveLength(4);
    expect(within(sawGroup).getAllByRole("article")).toHaveLength(3);

    const tk = within(istGroup).getByRole("article", { name: /7\.480 ₺/ });
    expect(within(tk).getByText("GİDİŞ · 14 Kas Cmt")).toBeInTheDocument();
    expect(within(tk).getByText("DÖNÜŞ · 18 Kas Çar")).toBeInTheDocument();
    expect(within(tk).getAllByText(/AKTARMASIZ/)).toHaveLength(2);
    expect(within(tk).getByText("AKTARMASIZ · 4 sa 05 dk")).toBeInTheDocument();
    expect(within(tk).getByText(/^Türk Hava Yolları ·/)).toBeInTheDocument();
    expect(within(tk).getByText("TK 1853")).toBeInTheDocument();
    const lh = within(istGroup).getByRole("article", { name: /5\.310 ₺/ });
    expect(within(lh).getByText(/^Lufthansa ·/).textContent).toBe("Lufthansa · LH 1301");
    expect(within(tk).getByText("1 YETİŞKİN")).toBeInTheDocument();
    expect(within(tk).getByText("TAHMİNİ TOPLAM · 2 YOLCU")).toBeInTheDocument();
    expect(within(tk).getByText("14.960 ₺")).toBeInTheDocument();
    expect(within(tk).getByText("ÖNBELLEKTEN · 16 EKİ TARİHİNDE BULUNDU · TAHMİNİ")).toBeInTheDocument();
    expect(within(tk).getByRole("link", { name: /Güncel fiyatı gör/ })).toHaveAttribute(
      "href",
      "https://www.aviasales.com/search/IST1411BCN18112?marker=4242",
    );
  });

  it("shows other return times of the same outbound flight under one card", async () => {
    const user = userEvent.setup();
    render(<FlightsView result={await resultFor(istanbul, { "IST-2026-11-14": ist.data, "SAW-2026-11-14": saw.data })} />);
    expect(screen.getAllByText(/^Lufthansa ·/)).toHaveLength(1);
    const lh = screen.getByText(/^Lufthansa ·/).closest("article")!;
    // The card shows the cheapest combination.
    expect(within(lh).getByText("5.310 ₺")).toBeInTheDocument();
    const summary = within(lh).getByText("Diğer dönüş saatleri (1)");
    const list = summary.closest("details")!;
    expect(list).not.toHaveAttribute("open");
    await user.click(summary);
    expect(list).toHaveAttribute("open");
    expect(within(list).getByText("DÖNÜŞ · 18 Kas Çar")).toBeVisible();
    expect(within(list).getByText("6.150 ₺")).toBeVisible();
    expect(within(list).getByText("1 YETİŞKİN · TOPLAM 12.300 ₺")).toBeVisible();
    expect(within(list).getByRole("link", { name: /Güncel fiyatı gör/ })).toHaveAttribute(
      "href",
      "https://www.aviasales.com/search/IST1411BCN18112?marker=4242",
    );
    // Cards without other returns have no list.
    expect(screen.getAllByText(/Diğer dönüş saatleri/)).toHaveLength(1);
  });

  it("marks the cheapest overall and the cheapest at each airport in accent", async () => {
    render(<FlightsView result={await resultFor(istanbul, { "IST-2026-11-14": ist.data, "SAW-2026-11-14": saw.data })} />);
    expect(screen.getAllByText("EN UCUZ")).toHaveLength(1);
    const best = screen.getByText("EN UCUZ").closest("article")!;
    expect(within(best).getByText("4.380 ₺")).toHaveClass("text-accent");
    expect(screen.getByText("IST İÇİN EN UCUZ").closest("article")).toHaveAccessibleName(/5\.310 ₺/);
    // Other prices stay ink.
    expect(screen.getByText("9.150 ₺")).not.toHaveClass("text-accent");
  });

  it("labels nearby dates and never shows them as the chosen ones", async () => {
    const ankara = { ...istanbul, origin: findOrigin("ESB")!, destination: findDestination("AMS")!, pax: 1 };
    render(<FlightsView result={await resultFor(ankara, { "ESB-2026-11": esbMonth.data })} />);
    expect(screen.getByText(/Seçtiğin tarihler için önbellekte fiyat yok/)).toBeInTheDocument();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(within(card).getByText("FARKLI TARİH · seçtiğin tarihler değil")).toBeInTheDocument();
    expect(within(cards[0]).getByText("GİDİŞ · 12 Kas Per")).toBeInTheDocument();
    expect(screen.queryByText("EN UCUZ")).not.toBeInTheDocument();
    expect(screen.getByText("±3 GÜNDE EN UCUZ")).toBeInTheDocument();
    // The booking link uses the ticket's own dates.
    expect(within(cards[0]).getByRole("link", { name: /Güncel fiyatı gör/ })).toHaveAttribute(
      "href",
      "https://www.aviasales.com/search/ESB1211AMS16111?marker=4242",
    );
  });

  it("says when there is no non-stop flight", async () => {
    const ankara = { ...istanbul, origin: findOrigin("ESB")!, destination: findDestination("AMS")!, direct: true };
    render(<FlightsView result={await resultFor(ankara, { "ESB-2026-11": esbMonth.data })} />);
    expect(screen.getByText("Bu tarihlerde aktarmasız uçuş bulunamadı.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aktarmasız/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("writes the non-stop filter to the URL", async () => {
    const user = userEvent.setup();
    render(<FlightsView result={await resultFor(istanbul, { "IST-2026-11-14": ist.data })} />);
    await user.click(screen.getByRole("button", { name: /Aktarmasız/ }));
    expect(replace).toHaveBeenCalledWith(
      "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2&direct=1#ucuslar",
      { scroll: false },
    );
  });

  it("shows a calm message and both links instead of cards without a token", async () => {
    const result = await searchFlights(istanbul, { token: null, partner: { marker: null, trs: null }, fixture: false });
    render(<FlightsView result={result} />);
    expect(screen.getByText("Tahmini fiyatlar için Travelpayouts bağlantısı henüz kurulmadı.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Aviasales'te güncel fiyatlar/ })).toHaveAttribute(
      "href",
      "https://www.aviasales.com/search/IST1411BCN18112",
    );
    expect(screen.getByRole("link", { name: /Google Flights'ta aç/ }).getAttribute("href")).toMatch(/^https:\/\/www\.google\.com\/travel\/flights\?/);
  });

  it("keeps an airline code it has no name for", async () => {
    const unknown = ist.data.map((t) => ({ ...t, airline: "ZZ" }));
    render(<FlightsView result={await resultFor(istanbul, { "IST-2026-11-14": unknown })} />);
    expect(screen.getAllByText(/^ZZ ·/)[0].textContent).toMatch(/^ZZ · ZZ \d+$/);
  });

  it("explains each failure in its own words", async () => {
    for (const [reason, text] of [
      ["unauthorized", /401/],
      ["rate-limited", /429/],
      ["server", /sunucu hatası/],
    ] as const) {
      const { unmount } = render(<FlightsView result={{ status: "unavailable", reason, links: { aviasales: "a", googleFlights: "g" } }} />);
      expect(screen.getByText(text)).toBeInTheDocument();
      unmount();
    }
  });

  it("states the source and that prices are cached estimates, and flags sample data", async () => {
    const result = await searchFlights(istanbul, { token: null, partner: { marker: null, trs: null }, fixture: true });
    render(<FlightsView result={result} />);
    expect(screen.getByText(/KAYNAK: TRAVELPAYOUTS \(AVIASALES\).*TAHMİNİ/)).toBeInTheDocument();
    expect(screen.getByText(/ÖRNEK VERİ · GELİŞTİRME FIXTURE'I · GERÇEK FİYAT DEĞİL/)).toBeInTheDocument();
  });
});
