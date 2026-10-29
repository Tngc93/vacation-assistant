import { describe, expect, it } from "vitest";
import { AIRLINE_NAMES, airlineName, WIKIDATA_AIRLINES } from "./airlines";
import file from "./airlines.json";
import { pickAirlines } from "@/lib/airlines/build";

const REQUIRED = "TK PC VF XQ W6 VY FR U2 LH LX OS KL AF BA IB AZ A3 LO SK AY EK QR EY FZ G9 J2 KC HY SU ME RJ MS AT TU SV PS BT JU FB OU".split(" ");

describe("airline names", () => {
  it("names every airline on the agreed list", () => {
    expect(REQUIRED).toHaveLength(40);
    for (const code of REQUIRED) expect(AIRLINE_NAMES[code], code).toBeTruthy();
  });

  it("uses well-formed IATA designators and unique names", () => {
    for (const code of Object.keys(AIRLINE_NAMES)) expect(code).toMatch(/^[A-Z0-9]{2}$/);
    const names = Object.values(AIRLINE_NAMES);
    expect(new Set(names).size).toBe(names.length);
  });

  it("looks codes up and keeps unknown ones as they are", () => {
    expect(airlineName("LH")).toBe("Lufthansa");
    expect(airlineName("vf")).toBe("AJet");
    expect(airlineName("TK")).toBe("Türk Hava Yolları");
    expect(airlineName("ZZ")).toBe("ZZ");
  });

  it("names foreign airlines from Wikidata too", () => {
    expect(file.source.terms).toBe("CC0 1.0");
    expect(Object.keys(WIKIDATA_AIRLINES).length).toBeGreaterThan(500);
    for (const code of Object.keys(WIKIDATA_AIRLINES)) expect(code).toMatch(/^[A-Z0-9]{2}$/);
    expect(airlineName("6E")).toBe("IndiGo");
    expect(airlineName("AA")).toBe("American Airlines");
    expect(airlineName("KE")).toBe("Korean Air");
    // Our short brand name wins over Wikidata's full one.
    expect(WIKIDATA_AIRLINES.PC).toBe("Pegasus Hava Yolları");
    expect(airlineName("PC")).toBe("Pegasus");
  });
});

describe("pickAirlines", () => {
  const row = (code: string, links: number, tr: string | null, en: string) => ({
    code: { value: code },
    links: { value: String(links) },
    en: { value: en },
    ...(tr ? { tr: { value: tr } } : {}),
  });

  it("names a reused designator after its best known current airline, Turkish label first", () => {
    const json = { results: { bindings: [row("TK", 27, "AJet", "AJet"), row("TK", 89, "Türk Hava Yolları", "Turkish Airlines"), row("6E", 48, null, "IndiGo"), row("x1", 5, null, "Bad")] } };
    expect(pickAirlines(json)).toEqual({
      airlines: { "6E": "IndiGo", TK: "Türk Hava Yolları", X1: "Bad" },
      // English names only where they differ, for the English interface.
      airlinesEn: { TK: "Turkish Airlines" },
    });
  });
});
