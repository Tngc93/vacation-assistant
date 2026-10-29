/**
 * IATA metropolitan area codes for cities whose airports are searched together. The price API takes these codes
 * as an origin (an `origin=LON` query returns tickets from every London airport), and Aviasales' links do too.
 * OurAirports has no such grouping (its municipality for Stansted is "London, Essex", for Sabiha Gökçen "Pendik,
 * Istanbul"), so the table is ours. `qid` is the city's Wikidata item, for its Turkish name. Our 68 destinations
 * group their own `airports` under their `cityCode` too (src/lib/origins/build.ts).
 */
export type MetroArea = { code: string; qid: string; nameEn: string; airports: readonly string[] };

export const METRO_AREAS: readonly MetroArea[] = [
  { code: "IST", qid: "Q406", nameEn: "Istanbul", airports: ["IST", "SAW"] },
  { code: "LON", qid: "Q84", nameEn: "London", airports: ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"] },
  { code: "PAR", qid: "Q90", nameEn: "Paris", airports: ["CDG", "ORY", "BVA"] },
  { code: "MIL", qid: "Q490", nameEn: "Milan", airports: ["MXP", "LIN", "BGY"] },
  { code: "ROM", qid: "Q220", nameEn: "Rome", airports: ["FCO", "CIA"] },
  { code: "MOW", qid: "Q649", nameEn: "Moscow", airports: ["SVO", "DME", "VKO", "ZIA"] },
  { code: "STO", qid: "Q1754", nameEn: "Stockholm", airports: ["ARN", "BMA", "NYO", "VST"] },
  { code: "OSL", qid: "Q585", nameEn: "Oslo", airports: ["OSL", "TRF"] },
  { code: "BRU", qid: "Q239", nameEn: "Brussels", airports: ["BRU", "CRL"] },
  { code: "VCE", qid: "Q641", nameEn: "Venice", airports: ["VCE", "TSF"] },
  { code: "BER", qid: "Q64", nameEn: "Berlin", airports: ["BER"] },
  { code: "BUH", qid: "Q19660", nameEn: "Bucharest", airports: ["OTP", "BBU"] },
  { code: "REK", qid: "Q1764", nameEn: "Reykjavík", airports: ["KEF", "RKV"] },
  { code: "THR", qid: "Q3616", nameEn: "Tehran", airports: ["IKA", "THR"] },
  { code: "DXB", qid: "Q612", nameEn: "Dubai", airports: ["DXB", "DWC"] },
  { code: "JNB", qid: "Q34647", nameEn: "Johannesburg", airports: ["JNB", "HLA"] },
  { code: "NYC", qid: "Q60", nameEn: "New York", airports: ["JFK", "EWR", "LGA"] },
  { code: "WAS", qid: "Q61", nameEn: "Washington", airports: ["IAD", "DCA", "BWI"] },
  { code: "CHI", qid: "Q1297", nameEn: "Chicago", airports: ["ORD", "MDW"] },
  { code: "DFW", qid: "Q16557", nameEn: "Dallas", airports: ["DFW", "DAL"] },
  { code: "HOU", qid: "Q16555", nameEn: "Houston", airports: ["IAH", "HOU"] },
  { code: "YTO", qid: "Q172", nameEn: "Toronto", airports: ["YYZ", "YTZ"] },
  { code: "SAO", qid: "Q174", nameEn: "São Paulo", airports: ["GRU", "CGH", "VCP"] },
  { code: "RIO", qid: "Q8678", nameEn: "Rio de Janeiro", airports: ["GIG", "SDU"] },
  { code: "BUE", qid: "Q1486", nameEn: "Buenos Aires", airports: ["EZE", "AEP"] },
  { code: "TYO", qid: "Q1490", nameEn: "Tokyo", airports: ["HND", "NRT"] },
  { code: "OSA", qid: "Q35765", nameEn: "Osaka", airports: ["KIX", "ITM", "UKB"] },
  { code: "SPK", qid: "Q37951", nameEn: "Sapporo", airports: ["CTS", "OKD"] },
  { code: "SEL", qid: "Q8684", nameEn: "Seoul", airports: ["ICN", "GMP"] },
  { code: "BJS", qid: "Q956", nameEn: "Beijing", airports: ["PEK", "PKX"] },
  { code: "SHA", qid: "Q8686", nameEn: "Shanghai", airports: ["PVG", "SHA"] },
  { code: "TPE", qid: "Q1867", nameEn: "Taipei", airports: ["TPE", "TSA"] },
  { code: "BKK", qid: "Q1861", nameEn: "Bangkok", airports: ["BKK", "DMK"] },
  { code: "JKT", qid: "Q3630", nameEn: "Jakarta", airports: ["CGK", "HLP"] },
];
