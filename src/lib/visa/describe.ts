import type { VisaRequirement } from "./requirements";

export type StampTone = "ok" | "warn" | "muted";

export type VisaPresentation = {
  /** Stamp main line (rendered uppercase). */
  label: string;
  /** Stamp second line, if any. */
  detail?: string;
  tone: StampTone;
  /** One calm sentence under the stamp. */
  sentence: string;
};

/** Stamp text, colour and explanation for a requirement. */
export function describeVisa(requirement: VisaRequirement, countryTr: string): VisaPresentation {
  switch (requirement.kind) {
    case "visa-free":
      return requirement.days
        ? {
            label: "Vizesiz",
            detail: `${requirement.days} gün`,
            tone: "ok",
            sentence: `${countryTr} için ${requirement.days} güne kadar vize gerekmiyor.`,
          }
        : {
            label: "Vizesiz",
            tone: "ok",
            sentence: `${countryTr} için vize gerekmiyor; veride kalış süresi belirtilmemiş.`,
          };
    case "visa-on-arrival":
      return {
        label: "Varışta vize",
        tone: "warn",
        sentence: `${countryTr} vizeyi varışta, sınır kapısında veriyor.`,
      };
    case "e-visa":
      return {
        label: "E-vize",
        tone: "warn",
        sentence: `${countryTr} için seyahatten önce çevrimiçi e-vize alman gerekiyor.`,
      };
    case "eta":
      return {
        label: "ETA",
        detail: "Elektronik izin",
        tone: "warn",
        sentence: `${countryTr} için seyahatten önce çevrimiçi elektronik seyahat izni (ETA) alman gerekiyor.`,
      };
    case "visa-required":
      return {
        label: "Vize gerekli",
        tone: "warn",
        sentence: `${countryTr} için seyahatten önce vize başvurusu yapman gerekiyor.`,
      };
    case "no-admission":
      return {
        label: "Giriş yok",
        tone: "warn",
        sentence: `Veriye göre ${countryTr} şu an Türk vatandaşlarını kabul etmiyor.`,
      };
    case "unknown":
      return {
        label: "Bilinmiyor",
        tone: "muted",
        sentence: `${countryTr} için vize bilgimiz yok; resmî sayfadan kontrol et.`,
      };
  }
}
