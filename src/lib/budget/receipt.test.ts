import { describe, expect, it } from "vitest";
import { buildReceipt, type ReceiptInput } from "./receipt";
import { EN, TR } from "@/test/i18n";

const flight = { kind: "ticket" as const, label: "Lufthansa · LH 1301 · IST → BCN", pricePerAdult: 14554, differentDates: false, sample: false, note: null };
const tcmb = (tryPerUnit: number) => ({ tryPerUnit, sourceId: "tcmb" as const, sourceName: "TCMB", date: "2026-10-16" });
const rates = { EUR: tcmb(55.618), USD: tcmb(49.4463) };
const base: ReceiptInput = { flight, stay: null, daily: null, amountCur: "TRY", cur: "TRY", rates, nights: 4, days: 5, pax: 2 };

describe("buildReceipt", () => {
  it("uses only the flight when nothing is entered, and says the total is partial", () => {
    const r = buildReceipt(base, TR);
    expect(r.rows.map((row) => [row.id, row.amount, row.missing])).toEqual([
      ["flight", 2910800, null],
      ["stay", null, "girilmedi"],
      ["daily", null, "girilmedi"],
    ]);
    expect(r.rows[0].detail).toBe("2 yolcu × 14.554 ₺ · Lufthansa · LH 1301 · IST → BCN");
    expect(r.rows[0].captions).toEqual(["TRAVELPAYOUTS · ÖNBELLEKTEN · TAHMİNİ"]);
    expect(r).toMatchObject({ total: 2910800, partial: true, perPerson: 1455400 });
  });

  it("writes the rows in English on the English pages, the lira in Intl's English form", () => {
    const r = buildReceipt({ ...base, stay: 300000 }, EN);
    expect(r.rows.map((row) => [row.label, row.missing])).toEqual([
      ["Flight", null],
      ["Stay", null],
      ["Daily spending", "not entered"],
    ]);
    expect(r.rows[0].detail).toBe("2 passengers × ₺14,554 · Lufthansa · LH 1301 · IST → BCN");
    expect(r.rows[0].captions).toEqual(["TRAVELPAYOUTS · CACHED · ESTIMATED"]);
    expect(r.rows[1].captions).toEqual(["ENTERED BY YOU · ESTIMATED"]);
  });

  it("shows a web-search flight price as the model's estimate, with its site, to verify before buying", () => {
    const r = buildReceipt({ ...base, flight: { kind: "web", host: "flypgs.com", perAdult: 820000 } }, TR);
    expect(r.rows[0]).toMatchObject({
      amount: 1640000,
      detail: "2 yolcu × 8.200 ₺ · web: flypgs.com",
      captions: ["YAPAY ZEKÂ WEB'DEN BULDU · TAHMİNİ", "SATIN ALMADAN ÖNCE DOĞRULA"],
    });
  });

  it("multiplies nights and days × people by what the user entered, in lira", () => {
    const r = buildReceipt({ ...base, stay: 300000, daily: 150000 }, TR);
    expect(r.rows[1]).toMatchObject({ detail: "4 gece × 3.000 ₺", amount: 1200000, captions: ["SENİN GİRDİĞİN · TAHMİNİ"] });
    expect(r.rows[2]).toMatchObject({ detail: "5 gün × 2 kişi × 1.500 ₺", amount: 1500000 });
    expect(r).toMatchObject({ total: 2910800 + 1200000 + 1500000, partial: false, perPerson: 2805400, rates: [], cur: "TRY" });
  });

  it("shows the lira flight in the chosen currency, keeping the lira price in the detail", () => {
    const r = buildReceipt({ ...base, amountCur: "EUR", cur: "EUR", stay: 12000, daily: 6000 }, TR);
    // 2 × 14.554 ₺ = 29.108 ₺ ÷ 55,618 = 523,36 EUR → €523
    expect(r.rows[0]).toMatchObject({ amount: 52300, detail: "2 yolcu × 14.554 ₺ · Lufthansa · LH 1301 · IST → BCN" });
    expect(r.rows[0].captions).toEqual(["TRAVELPAYOUTS · ÖNBELLEKTEN · TAHMİNİ"]);
    // Entered in euro: no conversion, the detail in euro (Intl places the symbol).
    expect(r.rows[1]).toMatchObject({ detail: "4 gece × €120", amount: 48000, captions: ["SENİN GİRDİĞİN · TAHMİNİ"] });
    expect(r.rows[2]).toMatchObject({ detail: "5 gün × 2 kişi × €60", amount: 60000 });
    expect(r).toMatchObject({ cur: "EUR", total: 52300 + 48000 + 60000, perPerson: 80200 });
    expect(r.rates).toEqual([{ currency: "EUR", ...tcmb(55.618) }]);
  });

  it("converts a web-search flight price (lira per adult) like a ticket", () => {
    const r = buildReceipt({ ...base, cur: "USD", flight: { kind: "web", host: "flypgs.com", perAdult: 820000 } }, TR);
    // 16.400 ₺ ÷ 49,4463 = 331,67 USD → $332
    expect(r.rows[0]).toMatchObject({ amount: 33200, detail: "2 yolcu × 8.200 ₺ · web: flypgs.com" });
    expect(r.rows[0].captions).toContain("YAPAY ZEKÂ WEB'DEN BULDU · TAHMİNİ");
  });

  it("converts entries in another currency through lira and names both rates", () => {
    const r = buildReceipt({ ...base, amountCur: "EUR", cur: "USD", stay: 12000 }, TR);
    // 480 EUR × 55,618 ÷ 49,4463 = 539,92 USD → $540
    expect(r.rows[1]).toMatchObject({ detail: "4 gece × €120 = €480", amount: 54000 });
    expect(r.rates.map((rate) => rate.currency)).toEqual(["USD", "EUR"]);
  });

  it("converts lira entries into a foreign currency, each row rounded once", () => {
    const r = buildReceipt({ ...base, amountCur: "TRY", cur: "EUR", stay: 300000 }, TR);
    // 4 × 3.000 ₺ = 12.000 ₺ ÷ 55,618 = 215,76 EUR → €216
    expect(r.rows[1]).toMatchObject({ detail: "4 gece × 3.000 ₺ = 12.000 ₺", amount: 21600 });
  });

  it("leaves a row out of the total when there is no rate for its currency", () => {
    const r = buildReceipt({ ...base, stay: 12000, amountCur: "EUR", cur: "TRY", rates: {} }, TR);
    expect(r.rows[1]).toMatchObject({ amount: null, missing: "kur alınamadı" });
    expect(r.rows[1].captions[1]).toBe("EUR KURU ALINAMADI · TOPLAMA EKLENMEDİ");
    expect(r).toMatchObject({ total: 2910800, partial: true });
  });

  it("says there is no flight price and leaves it out of the total", () => {
    const r = buildReceipt({ ...base, flight: { kind: "missing", reason: "SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK" }, stay: 300000 }, TR);
    expect(r.rows[0]).toMatchObject({ amount: null, missing: "uçuş fiyatı yok", captions: ["SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK"] });
    expect(r).toMatchObject({ total: 1200000, partial: true });
  });

  it("labels nearby-date and sample flights", () => {
    const r = buildReceipt({ ...base, flight: { ...flight, differentDates: true, sample: true } }, TR);
    expect(r.rows[0].captions).toEqual(["TRAVELPAYOUTS · ÖNBELLEKTEN · TAHMİNİ", "FARKLI TARİH", "ÖRNEK VERİ · GERÇEK FİYAT DEĞİL"]);
  });

  it("never guesses a rate for the flight either", () => {
    const r = buildReceipt({ ...base, cur: "GBP" }, TR);
    expect(r.rows[0]).toMatchObject({ amount: null, missing: "kur alınamadı" });
    expect(r.rows[0].captions).toContain("GBP KURU ALINAMADI · TOPLAMA EKLENMEDİ");
  });

  it("rounds each row to whole units so the rows add up to the total", () => {
    // 4 × 1250,10 = 5000,40 → 5000; 5 × 3 × 33,33 = 499,95 → 500
    const r = buildReceipt({ ...base, pax: 3, stay: 125010, daily: 3333 }, TR);
    expect(r.rows.map((row) => row.amount)).toEqual([4366200, 500000, 50000]);
    expect(r.total).toBe(4366200 + 500000 + 50000);
    expect(r.rows.every((row) => (row.amount ?? 0) % 100 === 0)).toBe(true);
    // 4.916.200 kuruş ÷ 3 = 16.387,33 ₺ → 16.387 ₺
    expect(r.perPerson).toBe(1638700);
    // The same in euro: 3 × 14.554 ₺ = 43.662 ₺ ÷ 55,618 = 785,03 → €785; 4 × 125,10 = 500,40 → €500; 15 × 3,33 = 49,95 → €50.
    const eur = buildReceipt({ ...base, pax: 3, cur: "EUR", amountCur: "EUR", stay: 12510, daily: 333 }, TR);
    expect(eur.rows.map((row) => row.amount)).toEqual([78500, 50000, 5000]);
    expect(eur.total).toBe(78500 + 50000 + 5000);
    expect(eur.rows.every((row) => (row.amount ?? 0) % 100 === 0)).toBe(true);
  });
});
