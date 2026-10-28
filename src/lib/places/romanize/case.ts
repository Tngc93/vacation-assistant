/**
 * Case for a romanized word in a cased script (Cyrillic, Greek). `chunks[i]` is the lower-case Latin for the
 * source letter `letters[i]` ("" when it is written with the letter before it, or not written at all). A word in
 * capitals stays in capitals ("ЦУМ" → "TSUM"); otherwise each capital letter capitalizes its chunk ("Щукин" →
 * "Shchukin").
 */
export function withCase(letters: readonly string[], chunks: readonly string[]): string {
  const upper = letters.map((c) => c !== c.toLowerCase());
  const cased = letters.filter((c) => c.toLowerCase() !== c.toUpperCase()).length;
  if (cased > 1 && upper.every((u, i) => u || letters[i].toLowerCase() === letters[i].toUpperCase())) {
    return chunks.join("").toUpperCase();
  }
  return chunks.map((c, i) => (upper[i] && c ? c[0].toUpperCase() + c.slice(1) : c)).join("");
}

/** First letter in capitals, for a script without case (Georgian, Hangul): "tbilisi" → "Tbilisi". */
export const capitalized = (word: string): string => (word ? word[0].toUpperCase() + word.slice(1) : word);
