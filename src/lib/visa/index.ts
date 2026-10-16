import visaData from "@/data/visa-tr.json";
import type { VisaFile } from "./csv";
import { parseRequirement, type VisaRequirement } from "./requirements";

export const VISA_DATA = visaData as VisaFile;

/** Official, per-country visa rules for Turkish citizens (T.C. Dışişleri Bakanlığı). */
export const MFA_VISA_URL = "https://www.mfa.gov.tr/turk-vatandaslarinin-tabi-oldugu-vize-uygulamalari.tr.mfa";

export type VisaInfo = {
  countryCode: string;
  requirement: VisaRequirement;
  /** False when the country is missing from the dataset. */
  inDataset: boolean;
};

/** Visa requirement for an ordinary Turkish passport travelling to `countryCode`. */
export function getVisaInfo(countryCode: string): VisaInfo {
  const code = countryCode.toUpperCase();
  const raw = VISA_DATA.requirements[code];
  return { countryCode: code, requirement: parseRequirement(raw), inDataset: raw !== undefined };
}

export { parseRequirement, type VisaKind, type VisaRequirement } from "./requirements";
