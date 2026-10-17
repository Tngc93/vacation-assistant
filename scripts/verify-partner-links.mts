// Checks that our locally built Aviasales partner links match what
// Travelpayouts' partner-links API returns for the same URLs.
// Needs TRAVELPAYOUTS_TOKEN, TRAVELPAYOUTS_MARKER and TRAVELPAYOUTS_PROJECT_ID
// (read from .env.local when present). Network; not run in CI. Never prints
// the token, marker or project id.
import { existsSync } from "node:fs";
import { aviasalesSearchUrl } from "../src/lib/flights/links";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const token = process.env.TRAVELPAYOUTS_TOKEN?.trim();
const marker = process.env.TRAVELPAYOUTS_MARKER?.trim() ?? null;
const trs = process.env.TRAVELPAYOUTS_PROJECT_ID?.trim() ?? null;
if (!token || !marker || !trs) {
  console.error("Set TRAVELPAYOUTS_TOKEN, TRAVELPAYOUTS_MARKER and TRAVELPAYOUTS_PROJECT_ID first.");
  process.exit(1);
}

const searches = [
  { origin: "IST", destination: "BCN", depart: "2026-11-14", return: "2026-11-18", pax: 2 },
  { origin: "ESB", destination: "AMS", depart: "2026-12-05", return: "2026-12-09", pax: 1 },
];
const plain = searches.map((s) => aviasalesSearchUrl(s));
const res = await fetch("https://api.travelpayouts.com/links/v1/create", {
  method: "POST",
  headers: { "X-Access-Token": token, "Content-Type": "application/json" },
  body: JSON.stringify({ trs: Number(trs), marker: Number(marker), shorten: false, links: plain.map((url) => ({ url })) }),
  signal: AbortSignal.timeout(15_000),
});
const json = (await res.json()) as { result?: { links?: Array<{ code: string; partner_url: string }> } };
const returned = json.result?.links ?? [];
let ok = res.ok && returned.length === searches.length;
searches.forEach((s, i) => {
  const same = returned[i]?.code === "success" && returned[i].partner_url === aviasalesSearchUrl(s, { marker, trs });
  ok &&= same;
  console.log(`${s.origin}→${s.destination}: ${same ? "matches the API" : "DIFFERS from the API"}`);
});
console.log(ok ? "OK: partner links match Travelpayouts' format." : `Failed (HTTP ${res.status}).`);
process.exit(ok ? 0 : 1);
