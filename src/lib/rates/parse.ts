import { XMLParser } from "fast-xml-parser";

/** Rates per currency in TRY, with the publication date. */
export type ParsedRates = { date: string; tryPerUnit: Record<string, number> };

// Entities, DOCTYPE declarations and processing instructions are never expanded.
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  htmlEntities: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  isArray: (name) => name === "Currency",
});

function positiveNumber(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** TCMB today.xml → forex selling rate per one unit (JPY is published per 100). */
export function parseTcmbXml(text: string): ParsedRates {
  const doc = xml.parse(text) as { Tarih_Date?: { "@_Tarih"?: string; Currency?: unknown[] } };
  const root = doc.Tarih_Date;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(root?.["@_Tarih"] ?? "");
  if (!root || !match) throw new Error("TCMB: unexpected document");
  const date = `${match[3]}-${match[2]}-${match[1]}`;

  const tryPerUnit: Record<string, number> = {};
  for (const item of root.Currency ?? []) {
    const c = item as { "@_CurrencyCode"?: string; Unit?: unknown; ForexSelling?: unknown };
    const code = c["@_CurrencyCode"];
    const unit = positiveNumber(c.Unit);
    const selling = positiveNumber(c.ForexSelling);
    if (code && /^[A-Z]{3}$/.test(code) && unit && selling) tryPerUnit[code] = selling / unit;
  }
  return { date, tryPerUnit };
}

/** Frankfurter /latest?base=XXX&symbols=TRY → TRY per one XXX. */
export function parseFrankfurter(json: unknown, currency: string): { date: string; tryPerUnit: number } {
  const data = json as { base?: string; date?: string; rates?: Record<string, unknown> };
  const rate = data?.rates?.TRY;
  if (data?.base !== currency || typeof rate !== "number" || !(rate > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(data.date ?? "")) {
    throw new Error("Frankfurter: unexpected response");
  }
  return { date: data.date!, tryPerUnit: rate };
}

/** open.er-api.com /v6/latest/XXX → TRY per one XXX. */
export function parseErApi(json: unknown, currency: string): { date: string; tryPerUnit: number } {
  const data = json as { result?: string; base_code?: string; time_last_update_unix?: number; rates?: Record<string, unknown> };
  const rate = data?.rates?.TRY;
  if (
    data?.result !== "success" ||
    data.base_code !== currency ||
    typeof rate !== "number" ||
    !(rate > 0) ||
    typeof data.time_last_update_unix !== "number"
  ) {
    throw new Error("Exchange Rate API: unexpected response");
  }
  return { date: new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10), tryPerUnit: rate };
}
