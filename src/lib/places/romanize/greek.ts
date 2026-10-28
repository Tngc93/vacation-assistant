import { withCase } from "./case";

/**
 * Greek to Latin by ELOT 743 (transcription, the system of Greek road signs and passports), without accents:
 * "Θεσσαλονίκη" → "Thessaloniki", "Ευαγγελισμός" → "Evangelismos".
 */
const LETTERS: Readonly<Record<string, string>> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n",
  ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};
/** After α, ε or η, υ is "v" before these and before a vowel… */
const VOICED = "βγδζλμνρ";
const VOWELS = "αεηιουω";
/** …and "f" before the others and at a word's end. γ is "n" before γ, ξ and χ (γκ stays "gk"). */
const NASAL_AFTER_G = "γξχ";

type Letter = { base: string; accent: boolean; diaeresis: boolean };

function parse(c: string): Letter {
  const [base, ...marks] = [...c.normalize("NFD")];
  return { base: base.toLowerCase(), accent: marks.includes("́"), diaeresis: marks.includes("̈") };
}

function word(run: string): string {
  const letters = [...run];
  const ls = letters.map(parse);
  const last = ls.length - 1;
  const chunks = ls.map(({ base }) => LETTERS[base] ?? base);
  for (let i = 0; i < ls.length; i++) {
    const { base } = ls[i];
    const next = ls[i + 1];
    if (base === "γ" && next && NASAL_AFTER_G.includes(next.base)) chunks[i] = "n";
    // μπ: "b" at the start and at the end of a word, "mp" inside it.
    if (base === "μ" && next?.base === "π" && (i === 0 || i + 1 === last)) {
      chunks[i] = "b";
      chunks[i + 1] = "";
    }
    if (!next || next.base !== "υ" || next.diaeresis) continue;
    if (base === "ο") chunks[i + 1] = "u";
    // αυ, ευ, ηυ: a diphthong unless the first vowel carries the accent (άυλος).
    if ("αεη".includes(base) && !ls[i].accent) {
      const after = ls[i + 2];
      chunks[i + 1] = after && (VOICED.includes(after.base) || VOWELS.includes(after.base)) ? "v" : "f";
    }
  }
  return withCase(letters, chunks);
}

export const isGreek = (name: string): boolean => /\p{Script=Greek}/u.test(name);

export const romanizeGreek = (name: string): string => name.normalize("NFC").replace(/\p{Script=Greek}+/gu, word);
