import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import { tr } from "./messages/tr";

type Tree = { [key: string]: string | readonly string[] | Tree };

/** Every leaf: "plan.title" → value. */
function leaves(tree: Tree, prefix = ""): Map<string, string | readonly string[]> {
  const out = new Map<string, string | readonly string[]>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || Array.isArray(value)) out.set(path, value as string | readonly string[]);
    else for (const [k, v] of leaves(value as Tree, path)) out.set(k, v);
  }
  return out;
}

/** The placeholders a message fills: `{name}` and the variable of `{count, plural, …}`. */
function placeholders(message: string): string[] {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{(\w+)(?:,\s*plural)?/g)) names.add(match[1]);
  return [...names].sort();
}

const TR = leaves(tr as unknown as Tree);
const EN = leaves(en as unknown as Tree);

/** Proper names that keep their Turkish letters in English. */
const NAMES_WITH_TURKISH_LETTERS = new Set(["flights.airports.ESB"]);

describe("message files", () => {
  it("have exactly the same keys in Turkish and English", () => {
    expect([...EN.keys()].sort()).toEqual([...TR.keys()].sort());
  });

  it("have the same kind of value and the same placeholders for every key", () => {
    for (const [key, value] of TR) {
      const other = EN.get(key)!;
      expect(Array.isArray(other), key).toBe(Array.isArray(value));
      if (typeof value === "string") expect(placeholders(other as string), key).toEqual(placeholders(value));
      else expect((other as readonly string[]).length, key).toBe(value.length);
    }
  });

  it("leave no English message empty or untranslated", () => {
    for (const [key, value] of EN) {
      for (const text of typeof value === "string" ? [value] : value) {
        expect(text.trim(), key).not.toBe("");
        if (!NAMES_WITH_TURKISH_LETTERS.has(key)) expect(text, key).not.toMatch(/[ıİğĞşŞ]/);
      }
    }
  });

  it("translate every sentence: an English message equal to the Turkish one is a name, a code or a symbol", () => {
    const same = [...TR].filter(([key, value]) => typeof value === "string" && value === EN.get(key) && /[a-zçğıöşü]{4}/.test(value));
    expect(same.map(([key]) => key).sort()).toEqual([
      "ai.model",
      "budget.detail.web",
      "events.types.festival",
      "flights.airports.ESB",
      "flights.airports.SAW",
      "og.planCountry",
    ]);
  });
});
