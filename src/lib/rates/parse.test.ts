import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseErApi, parseFrankfurter, parseTcmbXml } from "./parse";

const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

describe("TCMB today.xml", () => {
  const parsed = parseTcmbXml(fixture("tcmb-today.xml"));

  it("reads the bulletin date", () => {
    expect(parsed.date).toBe("2026-10-16");
  });

  it("uses forex selling per one unit", () => {
    expect(parsed.tryPerUnit.EUR).toBe(55.618);
    expect(parsed.tryPerUnit.USD).toBe(49.4463);
    // JPY is published per 100 yen.
    expect(parsed.tryPerUnit.JPY).toBeCloseTo(0.313773, 6);
    expect(parsed.tryPerUnit.KRW).toBe(0.03733);
  });

  it("skips currencies without a selling rate", () => {
    expect(parsed.tryPerUnit.XDR).toBeUndefined();
    expect(Object.keys(parsed.tryPerUnit).sort()).toEqual(["EUR", "JPY", "KRW", "USD"]);
  });

  it("rejects documents that are not a TCMB bulletin", () => {
    expect(() => parseTcmbXml("<html><body>Bakım çalışması</body></html>")).toThrow(/TCMB/);
    expect(() => parseTcmbXml("")).toThrow();
    expect(() => parseTcmbXml('<Tarih_Date Tarih="2026-10-16"></Tarih_Date>')).toThrow(/TCMB/);
  });

  it("refuses external entities (no XXE)", () => {
    const evil = `<?xml version="1.0"?>
<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<Tarih_Date Tarih="16.10.2026"><Currency CurrencyCode="USD"><Unit>1</Unit><ForexSelling>&xxe;</ForexSelling></Currency></Tarih_Date>`;
    expect(() => parseTcmbXml(evil)).toThrow();
  });

  it("does not expand internal entities into numbers", () => {
    const sneaky = `<?xml version="1.0"?>
<!DOCTYPE r [<!ENTITY big "9999">]>
<Tarih_Date Tarih="16.10.2026"><Currency CurrencyCode="EUR"><Unit>1</Unit><ForexSelling>&big;</ForexSelling></Currency></Tarih_Date>`;
    expect(parseTcmbXml(sneaky).tryPerUnit).toEqual({});
  });
});

describe("Frankfurter", () => {
  it("reads TRY per unit of the base currency", () => {
    expect(parseFrankfurter(JSON.parse(fixture("frankfurter-czk.json")), "CZK")).toEqual({
      date: "2026-10-15",
      tryPerUnit: 2.2481,
    });
  });

  it.each([
    [{ message: "not found" }],
    [{ base: "EUR", date: "2026-10-15", rates: { TRY: 55 } }],
    [{ base: "CZK", date: "2026-10-15", rates: {} }],
    [{ base: "CZK", date: "2026-10-15", rates: { TRY: -1 } }],
    [{ base: "CZK", rates: { TRY: 2 } }],
    [null],
  ])("rejects %j", (json) => {
    expect(() => parseFrankfurter(json, "CZK")).toThrow(/Frankfurter/);
  });
});

describe("Exchange Rate API", () => {
  it("reads TRY per unit and the update date", () => {
    expect(parseErApi(JSON.parse(fixture("erapi-aed.json")), "AED")).toEqual({ date: "2026-10-16", tryPerUnit: 13.5311 });
  });

  it.each([
    [{ result: "error", "error-type": "unsupported-code" }],
    [{ result: "success", base_code: "USD", time_last_update_unix: 1, rates: { TRY: 40 } }],
    [{ result: "success", base_code: "AED", rates: { TRY: 13 } }],
    [{ result: "success", base_code: "AED", time_last_update_unix: 1, rates: { TRY: "13" } }],
  ])("rejects %j", (json) => {
    expect(() => parseErApi(json, "AED")).toThrow(/Exchange Rate API/);
  });
});
