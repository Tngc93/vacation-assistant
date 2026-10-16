import { describe, expect, it } from "vitest";
import { describeVisa } from "./describe";
import { getVisaInfo } from ".";
import type { VisaRequirement } from "./requirements";

describe("stamp texts", () => {
  it.each<[VisaRequirement, { label: string; detail?: string; tone: string }]>([
    [{ kind: "visa-free", days: 90 }, { label: "Vizesiz", detail: "90 gün", tone: "ok" }],
    [{ kind: "visa-free", days: null }, { label: "Vizesiz", tone: "ok" }],
    [{ kind: "visa-on-arrival" }, { label: "Varışta vize", tone: "warn" }],
    [{ kind: "e-visa" }, { label: "E-vize", tone: "warn" }],
    [{ kind: "eta" }, { label: "ETA", detail: "Elektronik izin", tone: "warn" }],
    [{ kind: "visa-required" }, { label: "Vize gerekli", tone: "warn" }],
    [{ kind: "no-admission" }, { label: "Giriş yok", tone: "warn" }],
    [{ kind: "unknown", raw: "covid ban" }, { label: "Bilinmiyor", tone: "muted" }],
  ])("%j", (requirement, expected) => {
    const view = describeVisa(requirement, "Fransa");
    expect({ label: view.label, detail: view.detail, tone: view.tone }).toEqual({ detail: undefined, ...expected });
    expect(view.sentence).toContain("Fransa");
    expect(view.sentence.endsWith(".")).toBe(true);
  });

  it("names the stay length when the data has one", () => {
    expect(describeVisa({ kind: "visa-free", days: 90 }, "Bosna-Hersek").sentence).toBe(
      "Bosna-Hersek için 90 güne kadar vize gerekmiyor.",
    );
  });

  it("falls back to unknown for a country missing from the data", () => {
    const info = getVisaInfo("ZZ");
    expect(info.inDataset).toBe(false);
    expect(info.requirement).toEqual({ kind: "unknown", raw: null });
    expect(describeVisa(info.requirement, "Bilinmeyen Ülke").label).toBe("Bilinmiyor");
  });

  it("reads real entries from the committed data", () => {
    expect(getVisaInfo("ba").requirement).toEqual({ kind: "visa-free", days: 90 });
    expect(getVisaInfo("FR").requirement).toEqual({ kind: "visa-required" });
    expect(getVisaInfo("AE").requirement).toEqual({ kind: "e-visa" });
  });
});
