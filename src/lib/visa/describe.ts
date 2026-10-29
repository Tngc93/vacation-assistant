import type { I18n } from "@/i18n/i18n";
import type { VisaRequirement } from "./requirements";

/**
 * Three tones plus unknown: ok = no visa, sea = a formality before or on
 * arrival (visa on arrival, e-visa, ETA), warn = a visa or no entry,
 * muted = no data.
 */
export type StampTone = "ok" | "sea" | "warn" | "muted";

export type VisaPresentation = {
  /** Stamp main line (rendered uppercase). */
  label: string;
  /** Stamp second line, if any. */
  detail?: string;
  tone: StampTone;
  /** One calm sentence under the stamp. */
  sentence: string;
};

/** Stamp text, colour and explanation for a requirement, in the interface language. */
export function describeVisa(requirement: VisaRequirement, country: string, { m, f }: Pick<I18n, "m" | "f">): VisaPresentation {
  const t = m.visa;
  switch (requirement.kind) {
    case "visa-free":
      return requirement.days
        ? {
            label: t.visaFree,
            detail: f(t.days, { count: requirement.days }),
            tone: "ok",
            sentence: f(t.visaFreeDays, { country, count: requirement.days }),
          }
        : { label: t.visaFree, tone: "ok", sentence: f(t.visaFreeNoDays, { country }) };
    case "visa-on-arrival":
      return { label: t.onArrival, tone: "sea", sentence: f(t.onArrivalSentence, { country }) };
    case "e-visa":
      return { label: t.eVisa, tone: "sea", sentence: f(t.eVisaSentence, { country }) };
    case "eta":
      return { label: t.eta, detail: t.etaDetail, tone: "sea", sentence: f(t.etaSentence, { country }) };
    case "visa-required":
      return { label: t.required, tone: "warn", sentence: f(t.requiredSentence, { country }) };
    case "no-admission":
      return { label: t.noAdmission, tone: "warn", sentence: f(t.noAdmissionSentence, { country }) };
    case "unknown":
      return { label: t.unknown, tone: "muted", sentence: f(t.unknownSentence, { country }) };
  }
}
