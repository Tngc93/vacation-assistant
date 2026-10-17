/**
 * Names of airlines that fly from Turkey, by IATA designator. Each code was
 * checked against Wikidata (P229, current airline item noted next to it) on
 * 2026-10-17; names are the common brand names. Codes not listed are shown
 * as they are.
 */
export const AIRLINE_NAMES: Readonly<Record<string, string>> = {
  TK: "Türk Hava Yolları", // Q4548
  PC: "Pegasus", // Q1100424
  VF: "AJet", // Q483676
  XQ: "SunExpress", // Q1137136
  XC: "Corendon Airlines", // Q669002
  W6: "Wizz Air", // Q335147
  VY: "Vueling", // Q646741
  FR: "Ryanair", // Q170614
  U2: "easyJet", // Q191551
  EW: "Eurowings", // Q168836
  HV: "Transavia", // Q246952
  DE: "Condor", // Q312517
  LH: "Lufthansa", // Q9325
  LX: "Swiss", // Q156776
  OS: "Austrian Airlines", // Q781770
  KL: "KLM", // Q181912
  AF: "Air France", // Q131005
  BA: "British Airways", // Q8766
  IB: "Iberia", // Q187972
  AZ: "ITA Airways", // Q108251249
  A3: "Aegean Airlines", // Q380580
  LO: "LOT", // Q204268
  SK: "SAS", // Q187854
  AY: "Finnair", // Q201821
  BT: "airBaltic", // Q300924
  JU: "Air Serbia", // Q460373
  FB: "Bulgaria Air", // Q822130
  OU: "Croatia Airlines", // Q308974
  PS: "Ukraine International Airlines", // Q2211437
  SU: "Aeroflot", // Q58707
  J2: "Azerbaijan Airlines", // Q333679
  KC: "Air Astana", // Q406828
  HY: "Uzbekistan Airways", // Q610003
  EK: "Emirates", // Q180432
  QR: "Qatar Airways", // Q208033
  EY: "Etihad Airways", // Q212304
  FZ: "flydubai", // Q1048495
  G9: "Air Arabia", // Q406798
  SV: "Saudia", // Q541179
  ME: "Middle East Airlines", // Q859510
  RJ: "Royal Jordanian", // Q824225
  MS: "EgyptAir", // Q374740
  AT: "Royal Air Maroc", // Q866103
  TU: "Tunisair", // Q692811
};

/** "Lufthansa", or the code itself when it is not in the list. */
export function airlineName(code: string): string {
  return AIRLINE_NAMES[code.toUpperCase()] ?? code;
}
