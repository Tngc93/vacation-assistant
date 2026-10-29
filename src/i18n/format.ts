import { INTL_LOCALE, type Locale } from "./locales";

/** Values a message may take: `{name}` placeholders and `{count, plural, one {…} other {…}}` (with `#`). */
export type MessageValues = Record<string, string | number>;

const pluralRules = new Map<Locale, Intl.PluralRules>();
function plural(locale: Locale, n: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(INTL_LOCALE[locale]);
    pluralRules.set(locale, rules);
  }
  return rules.select(n);
}

/** The text between the brace at `open` and its matching close. */
function block(text: string, open: number): { body: string; end: number } {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
  }
  throw new Error(`Unclosed brace in message: ${text}`);
}

/** `one {# night} other {# nights}` → { one: "# night", other: "# nights" }, `=0 {…}` for exact values. */
function pluralOptions(spec: string): Map<string, string> {
  const options = new Map<string, string>();
  let i = 0;
  while (i < spec.length) {
    const key = /^\s*(=?\w+)\s*/.exec(spec.slice(i));
    if (!key) break;
    i += key[0].length;
    if (spec[i] !== "{") throw new Error(`Bad plural option in message: ${spec}`);
    const { body, end } = block(spec, i);
    options.set(key[1], body);
    i = end;
  }
  return options;
}

/**
 * Fills a message: `{name}` with its value (formatted as a number in the language when it is one), and
 * `{count, plural, =0 {…} one {…} other {…}}` by the language's plural rules, `#` being the count. A missing
 * value throws, so a message never shows a raw placeholder.
 */
export function formatMessage(locale: Locale, template: string, values: MessageValues = {}): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{", i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const { body, end } = block(template, open);
    const comma = body.indexOf(",");
    const name = (comma < 0 ? body : body.slice(0, comma)).trim();
    if (!(name in values)) throw new Error(`Message value "${name}" missing: ${template}`);
    const value = values[name];
    if (comma < 0) {
      out += typeof value === "number" ? value.toLocaleString(INTL_LOCALE[locale]) : value;
    } else {
      const rest = body.slice(comma + 1);
      const kind = /^\s*plural\s*,/.exec(rest);
      if (!kind || typeof value !== "number") throw new Error(`Only number plurals are supported: ${template}`);
      const options = pluralOptions(rest.slice(kind[0].length));
      const chosen = options.get(`=${value}`) ?? options.get(plural(locale, value)) ?? options.get("other");
      if (chosen === undefined) throw new Error(`Plural without "other": ${template}`);
      out += formatMessage(locale, chosen.replaceAll("#", value.toLocaleString(INTL_LOCALE[locale])), values);
    }
    i = end;
  }
  return out;
}
