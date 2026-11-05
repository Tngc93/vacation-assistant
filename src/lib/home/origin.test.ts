import { describe, expect, it } from "vitest";
import { ISTANBUL, homeOrigin } from "./origin";

describe("home route origin", () => {
  it("is İstanbul without a remembered origin", () => {
    expect(homeOrigin(null)).toEqual(ISTANBUL);
    expect(homeOrigin({ code: "IST" })).toEqual(ISTANBUL);
  });

  it("is the remembered city when it is one of our destinations", () => {
    expect(homeOrigin({ code: "LON" })).toMatchObject({ code: "LON", lat: expect.closeTo(51.5, 0) });
  });

  it("falls back to İstanbul for a city the browser has no coordinates for", () => {
    expect(homeOrigin({ code: "ESB" })).toEqual(ISTANBUL);
    expect(homeOrigin({ code: "CHI" })).toEqual(ISTANBUL);
  });
});
