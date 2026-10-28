import { capitalized } from "./case";

/**
 * Korean to Latin by the Revised Romanization (2000), from the sounds: each Hangul syllable is split into its
 * initial, vowel and final, and the sound changes between syllables of a word are applied before writing:
 * liaison ("서울의" → "Seourui"), nasalization ("국립" → "Gungnip"), ㄹ after ㄴ, ㅁ or ㅇ ("신라" → "Silla",
 * "종로" → "Jongno"), palatalization ("같이" → "gachi") and ㅎ ("좋고" → "joko"; in nouns ㅎ after ㄱ, ㄷ or ㅂ
 * stays: "북한산" → "Bukhansan"). Tense consonants are not written ("압구정" → "Apgujeong"). Exceptions that need
 * the word's parts are not made: ㄴ before ㄹ across a compound ("신문로" is "Sinmunno", here "Sinmullo") and an
 * inserted ㄴ ("학여울" is "Hangnyeoul").
 */

const INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const VOWELS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINALS = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ",
  "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const VOWEL_I = 20;

const INITIAL_SOUND: Readonly<Record<string, string>> = {
  ㄱ: "g", ㄲ: "kk", ㄴ: "n", ㄷ: "d", ㄸ: "tt", ㄹ: "r", ㅁ: "m", ㅂ: "b", ㅃ: "pp", ㅅ: "s", ㅆ: "ss", ㅇ: "",
  ㅈ: "j", ㅉ: "jj", ㅊ: "ch", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "h",
};
/** A final before a consonant or at a word's end is one of seven sounds. */
const FINAL_SOUND: Readonly<Record<string, string>> = { ㄱ: "k", ㄴ: "n", ㄷ: "t", ㄹ: "l", ㅁ: "m", ㅂ: "p", ㅇ: "ng" };
/** Each final (or cluster) reduced to the one it sounds as before a consonant. */
const NEUTRAL: Readonly<Record<string, string>> = {
  ㄱ: "ㄱ", ㄲ: "ㄱ", ㅋ: "ㄱ", ㄳ: "ㄱ", ㄺ: "ㄱ", ㄴ: "ㄴ", ㄵ: "ㄴ", ㄶ: "ㄴ", ㄷ: "ㄷ", ㅅ: "ㄷ", ㅆ: "ㄷ", ㅈ: "ㄷ",
  ㅊ: "ㄷ", ㅌ: "ㄷ", ㅎ: "ㄷ", ㄹ: "ㄹ", ㄼ: "ㄹ", ㄽ: "ㄹ", ㄾ: "ㄹ", ㅀ: "ㄹ", ㅁ: "ㅁ", ㄻ: "ㅁ", ㅂ: "ㅂ", ㅍ: "ㅂ",
  ㄿ: "ㅂ", ㅄ: "ㅂ", ㅇ: "ㅇ",
};
/** A cluster before a vowel: the first stays, the second moves on ("닭이" → "dalgi"). */
const CLUSTERS: Readonly<Record<string, readonly [string, string]>> = {
  ㄳ: ["ㄱ", "ㅅ"], ㄵ: ["ㄴ", "ㅈ"], ㄶ: ["ㄴ", "ㅎ"], ㄺ: ["ㄹ", "ㄱ"], ㄻ: ["ㄹ", "ㅁ"], ㄼ: ["ㄹ", "ㅂ"],
  ㄽ: ["ㄹ", "ㅅ"], ㄾ: ["ㄹ", "ㅌ"], ㄿ: ["ㄹ", "ㅍ"], ㅀ: ["ㄹ", "ㅎ"], ㅄ: ["ㅂ", "ㅅ"],
};
const NASAL: Readonly<Record<string, string>> = { ㄱ: "ㅇ", ㄷ: "ㄴ", ㅂ: "ㅁ" };
const ASPIRATED: Readonly<Record<string, string>> = { ㄱ: "ㅋ", ㄷ: "ㅌ", ㅈ: "ㅊ" };

export type Syllable = { initial: string; vowel: number; final: string };

const FIRST = 0xac00;
const LAST = 0xd7a3;
export const isHangulSyllable = (c: string): boolean => {
  const code = c.codePointAt(0)!;
  return code >= FIRST && code <= LAST;
};

/** A Hangul syllable split into its initial consonant, vowel (index) and final consonant ("" when none). */
export function decompose(c: string): Syllable {
  const code = c.codePointAt(0)! - FIRST;
  return { initial: INITIALS[Math.floor(code / 588)], vowel: Math.floor((code % 588) / 28), final: FINALS[code % 28] };
}

/** The sound changes between `a`'s final and `b`'s initial, in place. */
function join(a: Syllable, b: Syllable): void {
  const f = a.final;
  if (!f) return;
  if (b.initial === "ㅇ") {
    // Liaison: the final moves on to the next syllable (ㅇ stays, ㅎ goes silent).
    if (f === "ㅇ") return;
    if (f === "ㅎ") a.final = "";
    else if (CLUSTERS[f]) {
      const [stays, moves] = CLUSTERS[f];
      a.final = moves === "ㅎ" ? "" : stays;
      b.initial = moves === "ㅎ" ? stays : moves;
    } else {
      a.final = "";
      b.initial = f;
    }
    // Palatalization: ㄷ or ㅌ before 이.
    if (b.vowel === VOWEL_I && (b.initial === "ㄷ" || b.initial === "ㅌ")) b.initial = b.initial === "ㄷ" ? "ㅈ" : "ㅊ";
    return;
  }
  // ㅎ (or a cluster ending in it) before ㄱ, ㄷ, ㅈ makes them aspirated, before ㄴ it is ㄴ.
  if (f === "ㅎ" || f === "ㄶ" || f === "ㅀ") {
    const rest = f === "ㅎ" ? "" : CLUSTERS[f][0];
    if (ASPIRATED[b.initial]) {
      a.final = rest;
      b.initial = ASPIRATED[b.initial];
      return;
    }
    if (b.initial === "ㄴ") {
      a.final = rest || "ㄴ";
      if (rest === "ㄹ") b.initial = "ㄹ";
      return;
    }
  }
  let final = NEUTRAL[f] ?? f;
  if (b.initial === "ㄹ") {
    if (final === "ㄴ") final = "ㄹ";
    else if (final !== "ㄹ") b.initial = "ㄴ";
  } else if (b.initial === "ㄴ" && final === "ㄹ") {
    b.initial = "ㄹ";
  }
  if ((b.initial === "ㄴ" || b.initial === "ㅁ") && NASAL[final]) final = NASAL[final];
  a.final = final;
}

/** One word (a run of Hangul syllables) in Latin letters, lower case. */
export function romanizeHangulWord(run: string): string {
  const syllables = [...run].map(decompose);
  for (let i = 0; i + 1 < syllables.length; i++) join(syllables[i], syllables[i + 1]);
  return syllables
    .map((s, i) => {
      const afterL = syllables[i - 1]?.final === "ㄹ";
      const initial = s.initial === "ㄹ" && afterL ? "l" : INITIAL_SOUND[s.initial];
      const final = s.final ? FINAL_SOUND[NEUTRAL[s.final] ?? s.final] : "";
      return initial + VOWELS[s.vowel] + final;
    })
    .join("");
}

/** Whether every letter of the name in another script than Latin is a Hangul syllable. */
export const isKorean = (name: string): boolean => {
  const letters = name.match(/[^\P{L}\p{Script=Latin}]/gu) ?? [];
  return letters.length > 0 && letters.every(isHangulSyllable);
};

export const romanizeKorean = (name: string): string => name.replace(/[가-힣]+/g, (run) => capitalized(romanizeHangulWord(run)));
