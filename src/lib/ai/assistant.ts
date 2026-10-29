/**
 * The model suggests, the deterministic core decides (PRD 21–22). Every answer
 * is parsed with zod and checked against the candidate list; on a mistake the
 * model sees the errors and tries once more; after that the plan stays as it
 * was and the page says so.
 */
import { z } from "zod";
import { EVENING_CATEGORIES } from "@/lib/itinerary/config";
import { osmIdFromShort } from "@/lib/itinerary/ids";
import { PACES, type EditBatch, type EditCommand } from "./edits";
import { AiError } from "./errors";
import {
  editSystemPrompt,
  editUserMessage,
  planSystemPrompt,
  planUserMessage,
  type Candidate,
  type DayWindow,
  type PlanSummaryDay,
  type ReplyLanguage,
} from "./prompts";
import { complete, type ChatMessage, type Connection } from "./providers";

const shortIdSchema = z.string().regex(/^[nwrq]\d{1,12}$/);
/** Model text shown to people: plain, short, no markup (React escapes it; this keeps it tidy). */
export const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((s) => s.replace(/[<>]/g, "").replace(/[*_`#]+/g, ""));

export const aiPlanSchema = z.object({
  days: z
    .array(z.object({ day: z.number().int().min(1).max(31), stops: z.array(shortIdSchema).max(12), reason: plainText(400) }))
    .min(1)
    .max(31),
});

const dayNumber = z.number().int().min(1).max(31);
const position = z.number().int().min(0).max(11).optional();
export const aiEditSchema = z.object({
  commands: z
    .array(
      z.discriminatedUnion("op", [
        z.object({ op: z.literal("remove"), id: shortIdSchema }),
        z.object({ op: z.literal("add"), id: shortIdSchema, day: dayNumber, position }),
        z.object({ op: z.literal("move"), id: shortIdSchema, day: dayNumber, position }),
        z.object({ op: z.literal("pace"), value: z.enum(PACES as [string, ...string[]]) }),
        z.object({ op: z.literal("evening"), categories: z.array(z.enum(EVENING_CATEGORIES)).min(1).max(4) }),
      ]),
    )
    .max(20),
  reply: plainText(400),
});

/** The first JSON object in the text (models sometimes wrap it in a code fence). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

const zodErrors = (error: z.ZodError) => error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "answer"}: ${i.message}`);

export type AiPlan = { pinned: string[][]; reasons: Record<number, string> };

type PlanAnswer = z.infer<typeof aiPlanSchema>;

/** Candidates inside another chosen candidate: they go with it, so they are neither stops nor the model's mistake. */
function insideChosen(plan: PlanAnswer, candidates: readonly Candidate[]): Map<string, string> {
  const chosen = new Set(plan.days.flatMap((d) => d.stops));
  return new Map(candidates.flatMap((c) => (c.inside && chosen.has(c.id) && chosen.has(c.inside) ? [[c.id, c.inside] as const] : [])));
}

/**
 * Puts each chosen place that is inside another chosen place right after it (and after the ones already there), on
 * its day: a model that puts the Tsar Bell on another day than the Kremlin is corrected, not refused.
 */
export function keepInsideTogether(plan: PlanAnswer, candidates: readonly Candidate[]): PlanAnswer {
  const parentOf = insideChosen(plan, candidates);
  const days = plan.days.map((d) => ({ ...d, stops: d.stops.filter((id) => !parentOf.has(id)) }));
  for (const id of plan.days.flatMap((d) => d.stops).filter((s) => parentOf.has(s))) {
    const parent = parentOf.get(id)!;
    const day = days.find((d) => d.stops.includes(parent));
    if (!day || day.stops.includes(id)) continue;
    let at = day.stops.indexOf(parent) + 1;
    while (at < day.stops.length && parentOf.get(day.stops[at]) === parent) at++;
    day.stops.splice(at, 0, id);
  }
  return { ...plan, days };
}

/** Errors in English for the model; empty when the plan keeps every rule. */
export function checkPlan(plan: PlanAnswer, days: readonly DayWindow[], candidates: readonly Candidate[], maxStops: number): string[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const inside = insideChosen(plan, candidates);
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const d of plan.days) {
    const window = days.find((w) => w.day === d.day);
    if (!window) errors.push(`day ${d.day} does not exist in DATA.days`);
    else if (!window.window && d.stops.filter((id) => !inside.has(id)).length) errors.push(`day ${d.day} has no window, so it must have no stops`);
    const stops = d.stops.filter((id) => !inside.has(id)).length;
    if (stops > maxStops) errors.push(`day ${d.day} has ${stops} stops; at most ${maxStops}`);
    const farAreas = [...new Set(d.stops.flatMap((id) => (inside.has(id) ? [] : (byId.get(id)?.farArea ?? []))))];
    if (farAreas.length > 1) errors.push(`day ${d.day} goes to ${farAreas.length} far areas (${farAreas.join(", ")}); at most one a day`);
    for (const id of d.stops) {
      const c = byId.get(id);
      if (!c) errors.push(`day ${d.day}: "${id}" is not in DATA.candidates`);
      // A place inside another goes to that place's day; the engine leaves it out if it is closed then.
      else if (!inside.has(id) && c.closedDays.includes(d.day)) errors.push(`day ${d.day}: "${id}" is closed that day`);
      if (seen.has(id)) errors.push(`"${id}" appears more than once`);
      seen.add(id);
    }
  }
  return errors;
}

export function checkEdits(edit: z.infer<typeof aiEditSchema>, known: ReadonlySet<string>, dayCount: number): string[] {
  const errors: string[] = [];
  for (const c of edit.commands) {
    if ("id" in c && !known.has(c.id)) errors.push(`"${c.id}" is not in DATA.plan or DATA.candidates`);
    if ("day" in c && c.day > dayCount) errors.push(`day ${c.day} does not exist`);
  }
  return errors;
}

type Fetch = typeof fetch;
export type Attempted<T> =
  | { ok: true; value: T; attempts: number }
  /** `error` is "invalid" when the model's answers failed the schema or rules; absent when there was nothing to ask. */
  | { ok: false; errors: string[]; attempts: number; error?: AiError };

/**
 * Asks, validates, and on a mistake asks once more with the errors. Provider failures (key, quota, network) throw
 * AiError; a model that keeps breaking the rules gives `ok: false`.
 */
async function askChecked<S extends z.ZodType, T>(
  conn: Connection,
  system: string,
  user: string,
  schema: S,
  check: (value: z.infer<S>) => string[],
  convert: (value: z.infer<S>) => T,
  fetcher: Fetch,
): Promise<Attempted<T>> {
  const messages: ChatMessage[] = [{ role: "user", text: user }];
  let errors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await complete(conn, { system, messages, json: true }, fetcher);
    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      errors = ["the answer is not a JSON object"];
    }
    if (parsed !== undefined) {
      const result = schema.safeParse(parsed);
      errors = result.success ? check(result.data) : zodErrors(result.error);
      if (result.success && errors.length === 0) return { ok: true, value: convert(result.data), attempts: attempt };
    }
    messages.push(
      { role: "assistant", text },
      { role: "user", text: `Your answer broke these rules:\n- ${errors.join("\n- ")}\nAnswer again with corrected JSON only.` },
    );
  }
  return { ok: false, errors, attempts: 2, error: new AiError("invalid", { model: conn.model }) };
}

export async function requestAiPlan(
  conn: Connection,
  trip: { city: string; days: readonly DayWindow[]; candidates: readonly Candidate[]; maxStops: number; locale?: ReplyLanguage },
  fetcher: Fetch = fetch,
): Promise<Attempted<AiPlan>> {
  if (!trip.candidates.length) return { ok: false, errors: ["no candidates"], attempts: 0 };
  return askChecked(
    conn,
    planSystemPrompt(trip.maxStops, trip.locale),
    planUserMessage(trip.city, trip.days, trip.candidates),
    aiPlanSchema,
    (plan) => checkPlan(plan, trip.days, trip.candidates, trip.maxStops),
    (answer) => {
      const plan = keepInsideTogether(answer, trip.candidates);
      return {
        pinned: trip.days.map((w) => (plan.days.find((d) => d.day === w.day)?.stops ?? []).map((s) => osmIdFromShort(s)!)),
        reasons: Object.fromEntries(plan.days.filter((d) => d.stops.length).map((d) => [d.day, d.reason])),
      };
    },
    fetcher,
  );
}

export type AiEdit = { batch: EditBatch; reply: string };

export async function requestAiEdit(
  conn: Connection,
  edit: {
    request: string;
    city: string;
    plan: readonly PlanSummaryDay[];
    candidates: readonly Candidate[];
    pace: string;
    evening: readonly string[];
    locale?: ReplyLanguage;
  },
  fetcher: Fetch = fetch,
): Promise<Attempted<AiEdit>> {
  const known = new Set([...edit.candidates.map((c) => c.id), ...edit.plan.flatMap((d) => d.stops.map((s) => s.id))]);
  return askChecked(
    conn,
    editSystemPrompt(edit.locale),
    editUserMessage(edit.request.slice(0, 500), edit.city, edit.plan, edit.candidates, edit.pace, edit.evening),
    aiEditSchema,
    (value) => checkEdits(value, known, edit.plan.length),
    (value) => ({ batch: value.commands.map(toCommand), reply: value.reply }),
    fetcher,
  );
}

function toCommand(c: z.infer<typeof aiEditSchema>["commands"][number]): EditCommand {
  switch (c.op) {
    case "remove":
      return { op: "remove", id: osmIdFromShort(c.id)! };
    case "add":
    case "move":
      return { op: c.op, id: osmIdFromShort(c.id)!, day: c.day, ...(c.position === undefined ? {} : { position: c.position }) };
    case "pace":
      return { op: "pace", value: c.value as "relaxed" | "normal" };
    case "evening":
      return { op: "evening", categories: [...new Set(c.categories)] };
  }
}
