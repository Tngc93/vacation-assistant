import { describe, expect, it } from "vitest";
import { describeVisa } from "./describe";
import { getVisaInfo } from ".";
import type { VisaRequirement } from "./requirements";
import { EN, TR } from "@/test/i18n";

describe("stamp texts", () => {
  it.each<[VisaRequirement, { label: string; detail?: string; tone: string }]>([
    [{ kind: "visa-free", days: 90 }, { label: "Vizesiz", detail: "90 gün", tone: "ok" }],
    [{ kind: "visa-free", days: null }, { label: "Vizesiz", tone: "ok" }],
    [{ kind: "visa-on-arrival" }, { label: "Varışta vize", tone: "sea" }],
    [{ kind: "e-visa" }, { label: "E-vize", tone: "sea" }],
    [{ kind: "eta" }, { label: "ETA", detail: "Elektronik izin", tone: "sea" }],
    [{ kind: "visa-required" }, { label: "Vize gerekli", tone: "warn" }],
    [{ kind: "no-admission" }, { label: "Giriş yok", tone: "warn" }],
    [{ kind: "unknown", raw: "covid ban" }, { label: "Bilinmiyor", tone: "muted" }],
  ])("%j", (requirement, expected) => {
    const view = describeVisa(requirement, "Fransa", TR);
    expect({ label: view.label, detail: view.detail, tone: view.tone }).toEqual({ detail: undefined, ...expected });
    expect(view.sentence).toContain("Fransa");
    expect(view.sentence.endsWith(".")).toBe(true);
  });

  it("words the stamp in English on the English pages", () => {
    const view = describeVisa({ kind: "visa-free", days: 90 }, "France", EN);
    expect(view).toMatchObject({ label: "Visa-free", detail: "90 days", tone: "ok" });
    expect(view.sentence).toBe("No visa is needed for France for up to 90 days.");
  });

  it("names the stay length when the data has one", () => {
    expect(describeVisa({ kind: "visa-free", days: 90 }, "Bosna-Hersek", TR).sentence).toBe(
      "Bosna-Hersek için 90 güne kadar vize gerekmiyor.",
    );
  });

  it("falls back to unknown for a country missing from the data", () => {
    const info = getVisaInfo("ZZ");
    expect(info.inDataset).toBe(false);
    expect(info.requirement).toEqual({ kind: "unknown", raw: null });
    expect(describeVisa(info.requirement, "Bilinmeyen Ülke", TR).label).toBe("Bilinmiyor");
  });

  it("reads real entries from the committed data", () => {
    expect(getVisaInfo("ba").requirement).toEqual({ kind: "visa-free", days: 90 });
    expect(getVisaInfo("FR").requirement).toEqual({ kind: "visa-required" });
    expect(getVisaInfo("AE").requirement).toEqual({ kind: "e-visa" });
  });
});
