import { isCyrillicIn, romanizeCyrillic, type CyrillicLanguage } from "./cyrillic";
import { isGeorgian, romanizeGeorgian } from "./georgian";
import { isGreek, romanizeGreek } from "./greek";
import { isKorean, romanizeKorean } from "./hangul";

/**
 * The last step of the name rule (names.ts): a place name in another script, with no Latin name anywhere, written
 * in Latin letters by the official system of the city's country. The language comes from the country and is
 * confirmed by the name's letters: every letter outside the Latin script must be in that language's alphabet,
 * else the name stays as it is (a Greek bar name in Cologne, a Russian name in Sofia). Japanese, Chinese, Arabic
 * and Thai are not romanized.
 */

type Language = CyrillicLanguage | "el" | "ka" | "ko";

/**
 * The languages tried for a country's names, in order. Uzbekistan: Uzbek only with a letter of its own (ў, қ, ғ,
 * ҳ), else Russian, which most of Tashkent's Cyrillic names are.
 */
const BY_COUNTRY: Readonly<Record<string, readonly Language[]>> = {
  RU: ["ru"],
  UZ: ["uz", "ru"],
  RS: ["sr"],
  BA: ["sr"],
  ME: ["sr"],
  BG: ["bg"],
  MK: ["mk"],
  GR: ["el"],
  CY: ["el"],
  GE: ["ka"],
  KR: ["ko"],
};

const NOT_LATIN = /[^\P{L}\p{Script=Latin}\p{Script=Common}]/u;

function fits(language: Language, name: string): boolean {
  const others = name.replace(/[\p{Script=Latin}\P{L}]/gu, "");
  switch (language) {
    case "el":
      return isGreek(name) && !/[^\p{Script=Greek}]/u.test(others);
    case "ka":
      return isGeorgian(name) && !/[^\p{Script=Georgian}]/u.test(others);
    case "ko":
      return isKorean(name);
    default:
      return isCyrillicIn(language, name) && !/[^\p{Script=Cyrillic}]/u.test(others);
  }
}

function write(language: Language, name: string): string {
  switch (language) {
    case "el":
      return romanizeGreek(name);
    case "ka":
      return romanizeGeorgian(name);
    case "ko":
      return romanizeKorean(name);
    default:
      return romanizeCyrillic(language, name);
  }
}

/** The name in Latin letters by the country's official system; undefined when it is Latin already or not romanized. */
export function romanize(name: string, countryCode: string): string | undefined {
  if (!NOT_LATIN.test(name)) return undefined;
  const language = (BY_COUNTRY[countryCode] ?? []).find((l) => fits(l, name));
  if (!language) return undefined;
  const latin = write(language, name).normalize("NFC");
  return NOT_LATIN.test(latin) ? undefined : latin;
}
