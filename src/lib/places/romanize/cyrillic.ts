import { withCase } from "./case";

/**
 * Cyrillic to Latin by each country's official system. Each table lists the language's whole alphabet (lower
 * case): a name with a letter outside it is not in that language, and is not romanized with it.
 */
type Table = Readonly<Record<string, string>>;

/** Russian: ICAO Doc 9303 (7th edition), the system of Russian passports since 2014. "Красная площадь" → "Krasnaia ploshchad". */
const RU: Table = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "ie", ы: "y", ь: "", э: "e", ю: "iu", я: "ia",
};

/** Serbian: the official Latin alphabet (gajica), letter for letter. "Ђурђевдан" → "Đurđevdan". */
const SR: Table = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "đ", е: "e", ж: "ž", з: "z", и: "i", ј: "j", к: "k", л: "l",
  љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ћ: "ć", у: "u", ф: "f", х: "h",
  ц: "c", ч: "č", џ: "dž", ш: "š",
};

/** Bulgarian: the Streamlined System of the 2009 Transliteration Act; "-ия" at a word's end is "-ia" ("София" → "Sofia"). */
const BG: Table = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht",
  ъ: "a", ь: "y", ю: "yu", я: "ya",
};

/** Macedonian: the official digraph system of 2008 (passports and identity documents). "Ѓорче" → "Gjorche". */
const MK: Table = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", е: "e", ж: "zh", з: "z", ѕ: "dz", и: "i", ј: "j", к: "k",
  л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ќ: "kj", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", џ: "dj", ш: "sh",
};

/** Uzbek (Cyrillic): the official Latin alphabet (1995, as revised). "Ўзбекистон" → "Oʻzbekiston". */
const UZ: Table = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "s", ч: "ch", ш: "sh",
  ъ: "ʼ", ь: "", э: "e", ю: "yu", я: "ya", ў: "oʻ", қ: "q", ғ: "gʻ", ҳ: "h",
};
/** Letters only Uzbek has: a Cyrillic name in Tashkent without one of them is Russian. */
const UZ_ONLY = /[ўқғҳ]/iu;
const UZ_VOWELS = "аеёиоуэюяў";

export type CyrillicLanguage = "ru" | "sr" | "bg" | "mk" | "uz";
const TABLES: Readonly<Record<CyrillicLanguage, Table>> = { ru: RU, sr: SR, bg: BG, mk: MK, uz: UZ };

/** Whether every Cyrillic letter of the name is in the language's alphabet (and, for Uzbek, one is Uzbek's own). */
export function isCyrillicIn(language: CyrillicLanguage, name: string): boolean {
  const letters = name.toLowerCase().match(/\p{Script=Cyrillic}/gu) ?? [];
  if (!letters.length || !letters.every((c) => c in TABLES[language])) return false;
  return language !== "uz" || UZ_ONLY.test(name);
}

/** One run of Cyrillic letters (a word, or the Cyrillic part of "Zависть") in Latin letters. */
function word(language: CyrillicLanguage, run: string): string {
  const letters = [...run];
  const lower = letters.map((c) => c.toLowerCase());
  const table = TABLES[language];
  const chunks = lower.map((c, i) => {
    const before = lower[i - 1];
    if (language === "bg" && c === "я" && before === "и" && i === lower.length - 1) return "a";
    if (language === "uz" && c === "е" && (before === undefined || UZ_VOWELS.includes(before) || before === "ъ" || before === "ь")) return "ye";
    if (language === "uz" && c === "ц" && before !== undefined && UZ_VOWELS.includes(before)) return "ts";
    return table[c] ?? c;
  });
  return withCase(letters, chunks);
}

export const romanizeCyrillic = (language: CyrillicLanguage, name: string): string =>
  name.replace(/\p{Script=Cyrillic}+/gu, (run) => word(language, run));
