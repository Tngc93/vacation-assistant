import { z } from "zod";
import { findDestination } from "@/data/destinations";
import { DEFAULT_ORIGIN, ORIGINS, type OriginCode } from "@/data/origins";
import { checkTripDates, isIsoDate } from "./dates";

/**
 * The single place where search state is read from and written to the URL:
 * /plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2
 */

export const MIN_PASSENGERS = 1;
export const MAX_PASSENGERS = 9;

export type SearchState = {
  from: OriginCode;
  to: string;
  depart: string;
  return: string;
  pax: number;
};

/** A possibly incomplete search, e.g. a form being filled or a broken link. */
export type SearchDraft = { from: OriginCode } & Partial<Omit<SearchState, "from">>;

export type SearchField = keyof SearchState;
export type SearchIssue = { field: SearchField; message: string };

export type ParseResult =
  | { ok: true; value: SearchState }
  | { ok: false; draft: SearchDraft; issues: SearchIssue[] };

const ORIGIN_CODES = ORIGINS.map((o) => o.code) as [OriginCode, ...OriginCode[]];
const isoDate = z.string().refine(isIsoDate);

const fields = {
  from: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : v), z.enum(ORIGIN_CODES)),
  to: z
    .string()
    .transform((v) => v.toUpperCase())
    .refine((v) => findDestination(v) !== undefined),
  depart: isoDate,
  return: isoDate,
  pax: z.coerce.number().int().min(MIN_PASSENGERS).max(MAX_PASSENGERS),
} satisfies Record<SearchField, z.ZodType>;

const MESSAGES: Record<SearchField, { missing: string; invalid: string }> = {
  from: { missing: "Kalkış şehrini seç.", invalid: "Kalkış yalnızca İstanbul ya da Ankara olabilir." },
  to: { missing: "Bir varış şehri seç.", invalid: "Bu varış şehrini tanımıyoruz; listeden bir şehir seç." },
  depart: { missing: "Gidiş tarihini seç.", invalid: "Gidiş tarihi okunamadı." },
  return: { missing: "Dönüş tarihini seç.", invalid: "Dönüş tarihi okunamadı." },
  pax: { missing: "Yolcu sayısını seç.", invalid: `Yolcu sayısı ${MIN_PASSENGERS}–${MAX_PASSENGERS} arasında olmalı.` },
};

const FIELD_ORDER: readonly SearchField[] = ["from", "to", "depart", "return", "pax"];

type Input = URLSearchParams | Record<string, string | string[] | undefined>;

function read(input: Input, key: string): string | undefined {
  const raw = input instanceof URLSearchParams ? (input.get(key) ?? undefined) : input[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Parses and validates search params. Never throws: anything missing or
 * invalid is reported as an issue and left out of the draft, so the form can
 * be shown again with whatever was valid.
 */
export function parseSearch(input: Input, today: string): ParseResult {
  const draft: SearchDraft = { from: DEFAULT_ORIGIN };
  const issues: SearchIssue[] = [];

  for (const field of FIELD_ORDER) {
    const raw = read(input, field);
    if (raw === undefined) {
      if (field !== "from") issues.push({ field, message: MESSAGES[field].missing });
      continue;
    }
    const result = fields[field].safeParse(raw);
    if (result.success) {
      Object.assign(draft, { [field]: result.data });
    } else {
      issues.push({ field, message: MESSAGES[field].invalid });
    }
  }

  if (draft.depart && draft.return) {
    for (const issue of checkTripDates(draft.depart, draft.return, today)) {
      issues.push(issue);
      // A bad departure invalidates the return too; a bad return only itself.
      if (issue.field === "depart") {
        delete draft.depart;
        delete draft.return;
      } else {
        delete draft.return;
      }
    }
  }

  if (issues.length === 0 && draft.to && draft.depart && draft.return && draft.pax) {
    return { ok: true, value: { from: draft.from, to: draft.to, depart: draft.depart, return: draft.return, pax: draft.pax } };
  }
  return { ok: false, draft, issues };
}

/** Writes a full or partial search in a stable key order. */
export function serializeSearch(state: SearchDraft): string {
  const params = new URLSearchParams();
  for (const field of FIELD_ORDER) {
    const value = state[field];
    if (value !== undefined && value !== "") params.set(field, String(value));
  }
  return params.toString();
}

export function planHref(state: SearchState): string {
  return `/plan?${serializeSearch(state)}`;
}

/** Link back to the home form with the search filled in. */
export function editHref(state: SearchDraft): string {
  const query = serializeSearch(state);
  return query ? `/?${query}#arama` : "/#arama";
}
