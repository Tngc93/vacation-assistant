import { describe, expect, it } from "vitest";
import { parseRequirement } from "./requirements";

describe("parseRequirement", () => {
  it.each([
    ["90", { kind: "visa-free", days: 90 }],
    ["360", { kind: "visa-free", days: 360 }],
    ["7", { kind: "visa-free", days: 7 }],
    ["visa free", { kind: "visa-free", days: null }],
    ["visa on arrival", { kind: "visa-on-arrival" }],
    ["e-visa", { kind: "e-visa" }],
    ["eta", { kind: "eta" }],
    ["visa required", { kind: "visa-required" }],
    ["no admission", { kind: "no-admission" }],
    [" Visa Required ", { kind: "visa-required" }],
  ])("maps %j", (raw, expected) => {
    expect(parseRequirement(raw)).toEqual(expected);
  });

  it.each(["-1", "0", "covid ban", "Hayya Entry Permit", "visa-free", "", "tourist card"])(
    "never guesses: %j becomes unknown with the raw value kept",
    (raw) => {
      expect(parseRequirement(raw)).toEqual({ kind: "unknown", raw });
    },
  );

  it("treats a missing value as unknown", () => {
    expect(parseRequirement(undefined)).toEqual({ kind: "unknown", raw: null });
    expect(parseRequirement(null)).toEqual({ kind: "unknown", raw: null });
  });
});
