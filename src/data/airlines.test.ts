import { describe, expect, it } from "vitest";
import { AIRLINE_NAMES, airlineName } from "./airlines";

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
});
