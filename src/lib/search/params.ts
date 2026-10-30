import { z } from "zod";
import { findDestination } from "@/data/destinations";
import { DEFAULT_ORIGIN, type OriginCode } from "@/data/origins";
import { localePath, type Locale } from "@/i18n/locales";
import { checkTripDates, isIsoDate, type DateIssueCode } from "./dates";

/**
 * The single place where search state is read from and written to the URL:
 * /plan?to=BCN&depart=2026-11-14&return=2026-11-18 (plus &from=ESB and &pax=2 when they differ from the defaults).
 *
 * The home page asks only where and when; the origin (İstanbul, IST + SAW) and the number of people (1) are
 * defaults the plan page changes in its stay and flight sections (2026-10-22). Links that carry them still open
 * the same plan.
 *
 * The origin can be any city with an airport (2026-10-29). The list is server-only, so here `from` is only checked
 * for shape (three letters); the server resolves it (src/lib/origins/data.ts `resolveOrigin`): a city code, or an
 * airport code mapped to its city (`?from=SAW` opens İstanbul; Ankara is ESB itself), else İstanbul.
 */

export const MIN_PASSENGERS = 1;
export const MAX_PASSENGERS = 9;
export const DEFAULT_PASSENGERS = 1;

export type SearchState = {
  from: OriginCode;
  to: string;
  depart: string;
  return: string;
  pax: number;
};

/** A possibly incomplete search, e.g. a form being filled or a broken link: the route may be missing, never the defaults. */
export type SearchDraft = Pick<SearchState, "from" | "pax"> & Partial<Pick<SearchState, "to" | "depart" | "return">>;

/** The fields a person chooses on the home page; only these can make a link incomplete. */
export type SearchField = "to" | "depart" | "return";
/** Why a field cannot make a plan; the interface words it (messages `search.issues`). */
export type SearchIssueCode = `${SearchField}${"Missing" | "Invalid"}` | DateIssueCode;
export type SearchIssue = { field: SearchField; code: SearchIssueCode };

export type ParseResult =
  | { ok: true; value: SearchState }
  | { ok: false; draft: SearchDraft; issues: SearchIssue[] };

const isoDate = z.string().refine(isIsoDate);

const originField = z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : v), z.string().regex(/^[A-Z]{3}$/));
const paxField = z.coerce.number().int().min(MIN_PASSENGERS).max(MAX_PASSENGERS);

const fields = {
  to: z
    .string()
    .transform((v) => v.toUpperCase())
    .refine((v) => findDestination(v) !== undefined),
  depart: isoDate,
  return: isoDate,
} satisfies Record<SearchField, z.ZodType>;

/** The route fields, in URL order. */
export const SEARCH_FIELDS: readonly SearchField[] = ["to", "depart", "return"];

type Input = URLSearchParams | Record<string, string | string[] | undefined>;

function read(input: Input, key: string): string | undefined {
  const raw = input instanceof URLSearchParams ? (input.get(key) ?? undefined) : input[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** `?from=` (an IATA code, upper case), or İstanbul when it is missing or malformed; the server checks it is known. */
export function parseOrigin(input: Input): OriginCode {
  const result = originField.safeParse(read(input, "from"));
  return result.success ? result.data : DEFAULT_ORIGIN;
}

/** `?pax=`, or 1 when it is missing or out of range. */
export function parsePassengers(input: Input): number {
  const raw = read(input, "pax");
  const result = paxField.safeParse(raw);
  return raw !== undefined && result.success ? result.data : DEFAULT_PASSENGERS;
}

/**
 * Parses and validates search params. Never throws: a missing or invalid destination or date is reported as an
 * issue and left out of the draft, so the form can be shown again with whatever was valid. The origin and the
 * number of people fall back to their defaults without an issue.
 */
export function parseSearch(input: Input, today: string): ParseResult {
  const draft: SearchDraft = { from: parseOrigin(input), pax: parsePassengers(input) };
  const issues: SearchIssue[] = [];

  for (const field of SEARCH_FIELDS) {
    const raw = read(input, field);
    if (raw === undefined) {
      issues.push({ field, code: `${field}Missing` });
      continue;
    }
    const result = fields[field].safeParse(raw);
    if (result.success) {
      Object.assign(draft, { [field]: result.data });
    } else {
      issues.push({ field, code: `${field}Invalid` });
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

  if (issues.length === 0 && draft.to && draft.depart && draft.return) {
    return { ok: true, value: { from: draft.from, to: draft.to, depart: draft.depart, return: draft.return, pax: draft.pax } };
  }
  return { ok: false, draft, issues };
}

/** True when the link names any part of the route (the plan page then says what is missing in it). */
export function hasRouteParams(input: Input): boolean {
  return SEARCH_FIELDS.some((field) => read(input, field) !== undefined);
}

/**
 * Writes a full or partial search: the origin, the route, then the number of people. The origin and the number
 * of people are left out when they are the defaults, so a plan from the home page is /plan?to=…&depart=…&return=….
 */
export function serializeSearch(state: Partial<SearchState>): string {
  const params = new URLSearchParams();
  if (state.from && state.from !== DEFAULT_ORIGIN) params.set("from", state.from);
  for (const field of SEARCH_FIELDS) {
    const value = state[field];
    if (value !== undefined && value !== "") params.set(field, value);
  }
  if (state.pax !== undefined && state.pax !== DEFAULT_PASSENGERS) params.set("pax", String(state.pax));
  return params.toString();
}

/**
 * The plan URL after the origin or the number of people changes on the plan page. Every other param stays
 * (`cats`, `skip`, `ai`, `edit`, the budget); a new origin drops the flight in the budget (`flight`, `wf`, `wfs`),
 * which was a ticket or a web price from the other city's airports.
 */
export function writeTripParams(params: URLSearchParams, change: { from?: OriginCode; pax?: number }): URLSearchParams {
  const next = new URLSearchParams(params);
  if (change.from !== undefined && change.from !== parseOrigin(params)) {
    for (const key of ["flight", "wf", "wfs"]) next.delete(key);
  }
  if (change.from !== undefined) {
    if (change.from === DEFAULT_ORIGIN) next.delete("from");
    else next.set("from", change.from);
  }
  if (change.pax !== undefined) {
    if (change.pax === DEFAULT_PASSENGERS) next.delete("pax");
    else next.set("pax", String(change.pax));
  }
  return next;
}

export function planHref(state: SearchState, locale: Locale = "tr"): string {
  return `${localePath(locale, "/plan")}?${serializeSearch(state)}`;
}

/** Link back to the home form with the city and the dates filled in (and a non-default origin or group, kept for the next plan). */
export function editHref(state: Partial<SearchState>, locale: Locale = "tr"): string {
  const query = serializeSearch(state);
  return `${localePath(locale, "/")}${query ? `?${query}` : ""}#arama`;
}
