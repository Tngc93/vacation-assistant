import { capitalized } from "./case";

/**
 * Georgian to Latin by the national system of 2002, apostrophes for the ejectives included: "თბილისი" →
 * "Tbilisi", "წყალტუბო" → "Ts'q'alt'ubo". Georgian has no case; each word starts with a capital.
 */
const LETTERS: Readonly<Record<string, string>> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i", კ: "k'", ლ: "l", მ: "m", ნ: "n",
  ო: "o", პ: "p'", ჟ: "zh", რ: "r", ს: "s", ტ: "t'", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q'", შ: "sh",
  ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts'", ჭ: "ch'", ხ: "kh", ჯ: "j", ჰ: "h",
};
const MTAVRULI = 0x1c90 - 0x10d0;
/** Mtavruli (the capitals, U+1C90…) to Mkhedruli. */
const mkhedruli = (c: string) => {
  const code = c.codePointAt(0)!;
  return code >= 0x1c90 && code <= 0x1cbf ? String.fromCodePoint(code - MTAVRULI) : c;
};

/** Whether every Georgian letter of the name is one of the 33 of today's alphabet. */
export function isGeorgian(name: string): boolean {
  const letters = name.match(/\p{Script=Georgian}/gu) ?? [];
  return letters.length > 0 && letters.every((c) => mkhedruli(c) in LETTERS);
}

export const romanizeGeorgian = (name: string): string =>
  name.replace(/\p{Script=Georgian}+/gu, (run) => capitalized([...run].map((c) => LETTERS[mkhedruli(c)] ?? c).join("")));
