import { describe, expect, it } from "vitest";
import { buildReceipt, type ReceiptInput } from "./receipt";

const flight = { kind: "ticket" as const, label: "Lufthansa · LH 1301 · IST → BCN", pricePerAdult: 14554, differentDates: false, sample: false, note: null };
const tcmb = { ok: true as const, currency: "EUR", tryPerUnit: 55.618, sourceId: "tcmb", sourceName: "TCMB", date: "2026-10-16" };
const base: ReceiptInput = { flight, stay: null, daily: null, cur: "TRY", rate: tcmb, nights: 4, days: 5, pax: 2 };

describe("buildReceipt", () => {
  it("uses only the flight when nothing is entered, and says the total is partial", () => {
    const r = buildReceipt(base);
    expect(r.rows.map((row) => [row.id, row.amount, row.missing])).toEqual([
      ["flight", 2910800, null],
      ["stay", null, "girilmedi"],
      ["daily", null, "girilmedi"],
    ]);
    expect(r.rows[0].detail).toBe("2 yolcu × 14.554 ₺ · Lufthansa · LH 1301 · IST → BCN");
    expect(r.rows[0].captions).toEqual(["TRAVELPAYOUTS · ÖNBELLEKTEN · TAHMİNİ"]);
    expect(r).toMatchObject({ total: 2910800, partial: true, perPerson: 1455400 });
  });

  it("multiplies nights and days × people by what the user entered, in lira", () => {
    const r = buildReceipt({ ...base, stay: 300000, daily: 150000 });
    expect(r.rows[1]).toMatchObject({ detail: "4 gece × 3.000 ₺", amount: 1200000, captions: ["SENİN GİRDİĞİN · TAHMİNİ"] });
    expect(r.rows[2]).toMatchObject({ detail: "5 gün × 2 kişi × 1.500 ₺", amount: 1500000 });
    expect(r).toMatchObject({ total: 2910800 + 1200000 + 1500000, partial: false, perPerson: 2805400, rate: null });
  });

  it("converts local-currency entries with the rate and names its source and date", () => {
    const r = buildReceipt({ ...base, stay: 12000, daily: 6000, cur: "EUR" });
    // 4 × 120 EUR = 480 EUR × 55,618 = 26.696,64 → 26.697 ₺
    expect(r.rows[1]).toMatchObject({ detail: "4 gece × 120 EUR = 480 EUR", amount: 2669700 });
    expect(r.rows[1].captions).toEqual(["SENİN GİRDİĞİN · TAHMİNİ", "KUR: TCMB · 16 EKİ"]);
    // 5 × 2 × 60 EUR = 600 EUR × 55,618 = 33.370,80 → 33.371 ₺
    expect(r.rows[2].amount).toBe(3337100);
    expect(r.rate).toEqual(tcmb);
  });

  it("leaves a local-currency row out of the total when there is no rate", () => {
    const r = buildReceipt({ ...base, stay: 12000, cur: "EUR", rate: { ok: false, currency: "EUR" } });
    expect(r.rows[1]).toMatchObject({ amount: null, missing: "kur alınamadı" });
    expect(r.rows[1].captions[1]).toBe("EUR KURU ALINAMADI · TOPLAMA EKLENMEDİ");
    expect(r).toMatchObject({ total: 2910800, partial: true });
  });

  it("says there is no flight price and leaves it out of the total", () => {
    const r = buildReceipt({ ...base, flight: { kind: "missing", reason: "SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK" }, stay: 300000 });
    expect(r.rows[0]).toMatchObject({ amount: null, missing: "uçuş fiyatı yok", captions: ["SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK"] });
    expect(r).toMatchObject({ total: 1200000, partial: true });
  });

  it("labels nearby-date and sample flights", () => {
    const r = buildReceipt({ ...base, flight: { ...flight, differentDates: true, sample: true } });
    expect(r.rows[0].captions).toEqual(["TRAVELPAYOUTS · ÖNBELLEKTEN · TAHMİNİ", "FARKLI TARİH", "ÖRNEK VERİ · GERÇEK FİYAT DEĞİL"]);
  });

  it("rounds each row to whole lira so the rows add up to the total", () => {
    // 4 × 1250,10 = 5000,40 → 5000; 5 × 3 × 33,33 = 499,95 → 500
    const r = buildReceipt({ ...base, pax: 3, stay: 125010, daily: 3333 });
    expect(r.rows.map((row) => row.amount)).toEqual([4366200, 500000, 50000]);
    expect(r.total).toBe(4366200 + 500000 + 50000);
    expect(r.rows.every((row) => (row.amount ?? 0) % 100 === 0)).toBe(true);
    // 4.916.200 kuruş ÷ 3 = 16.387,33 ₺ → 16.387 ₺
    expect(r.perPerson).toBe(1638700);
  });
});
