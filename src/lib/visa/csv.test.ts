import { describe, expect, it } from "vitest";
import { buildVisaFile, extractPassportRows, type VisaSource } from "./csv";

const CSV = [
  "Passport,Destination,Requirement",
  "AF,AL,e-visa",
  "TR,FR,visa required",
  "TR,BA,90",
  "TR,AE,e-visa",
  "TR,TR,-1",
  "US,TR,e-visa",
  "TR,AL,visa free",
].join("\n");

const SOURCE: VisaSource = {
  name: "Passport Index Data",
  repository: "https://github.com/example/passport-index-data",
  file: "passport-index-tidy-iso2.csv",
  url: "https://raw.githubusercontent.com/example/passport-index-data/abc/passport-index-tidy-iso2.csv",
  commit: "a".repeat(40),
  dataDate: "2026-02-18",
  license: "MIT",
};

describe("tidy CSV → visa JSON", () => {
  it("keeps only the requested passport, sorted by destination, raw values untouched", () => {
    expect(extractPassportRows(CSV, "TR")).toEqual({
      AE: "e-visa",
      AL: "visa free",
      BA: "90",
      FR: "visa required",
      TR: "-1",
    });
    expect(Object.keys(extractPassportRows(CSV, "tr"))).toEqual(["AE", "AL", "BA", "FR", "TR"]);
  });

  it("handles a BOM, CRLF line endings, blank lines and quoted fields", () => {
    const csv = '﻿Passport,Destination,Requirement\r\nTR,"GB","visa required"\r\n\r\nTR,JP,90\r\n';
    expect(extractPassportRows(csv, "TR")).toEqual({ GB: "visa required", JP: "90" });
  });

  it("refuses an unexpected header", () => {
    expect(() => extractPassportRows("from,to,value\nTR,FR,90", "TR")).toThrow(/header/);
  });

  it("refuses duplicate rows and malformed codes", () => {
    expect(() => extractPassportRows(`${CSV}\nTR,FR,90`, "TR")).toThrow(/Duplicate/);
    expect(() => extractPassportRows("Passport,Destination,Requirement\nTR,FRA,90", "TR")).toThrow(/destination code/);
  });

  it("refuses a file with no rows for the passport", () => {
    expect(() => extractPassportRows(CSV, "ZZ")).toThrow(/No rows/);
  });

  it("builds the committed file shape with its source", () => {
    expect(buildVisaFile(CSV, "tr", SOURCE, "2026-10-16")).toEqual({
      passport: "TR",
      source: SOURCE,
      downloadedAt: "2026-10-16",
      requirements: { AE: "e-visa", AL: "visa free", BA: "90", FR: "visa required", TR: "-1" },
    });
  });
});
