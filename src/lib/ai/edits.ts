/**
 * Plan edits as structured commands (never free text): the model proposes
 * them, the deterministic engine applies them. They live in the URL (`?ai=`,
 * `?edit=`), so a shared link reopens the same plan; the key never does.
 */
import { EVENING_CATEGORIES, type EveningCategory } from "@/lib/itinerary/config";
import { osmIdFromShort, shortId } from "@/lib/itinerary/ids";
import type { Itinerary } from "@/lib/itinerary/plan";

export type Pace = "relaxed" | "normal";
export const PACES: readonly Pace[] = ["relaxed", "normal"];

/** Place ids are full ids ("node/123"); days are 1-based; positions 0-based within the day's daytime stops. */
export type EditCommand =
  | { op: "remove"; id: string }
  | { op: "add"; id: string; day: number; position?: number }
  | { op: "move"; id: string; day: number; position?: number }
  | { op: "pace"; value: Pace }
  | { op: "evening"; categories: EveningCategory[] };

/** One chat message's commands, undone together. */
export type EditBatch = EditCommand[];

export type PlanState = {
  /** Daytime stops per day (index 0 = day 1), in visiting order. */
  pinned: string[][];
  pace: Pace;
  evening: EveningCategory[];
};

const SHORT = /^[nwrq]\d{1,12}$/;

/*
 * Only characters URLSearchParams leaves as they are (letters, digits, "-", ".", "_", "*"), so links stay readable.
 */

/** `?ai=_n1.w2__q3`: the AI plan's daytime stops per day, short ids split by ".", days by "_". */
export function encodePinned(pinned: readonly (readonly string[])[]): string {
  return pinned.map((day) => day.map(shortId).join(".")).join("_");
}

export function parsePinned(raw: string | string[] | null | undefined): string[][] | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.length > 2000) return null;
  const days = value.split("_").map((day) => (day ? day.split(".") : []));
  if (days.length > 31 || days.some((d) => d.length > 12 || d.some((s) => !SHORT.test(s)))) return null;
  return days.map((d) => d.map((s) => osmIdFromShort(s)!));
}

/** `?edit=rm-n1.add-w2-3-0_pace-relaxed.eve-cocktail*pub`: batches split by "_", commands by ".". */
export function encodeEdits(batches: readonly EditBatch[]): string {
  return batches
    .map((batch) =>
      batch
        .map((c) => {
          switch (c.op) {
            case "remove":
              return `rm-${shortId(c.id)}`;
            case "add":
            case "move":
              return `${c.op === "add" ? "add" : "mv"}-${shortId(c.id)}-${c.day}${c.position === undefined ? "" : `-${c.position}`}`;
            case "pace":
              return `pace-${c.value}`;
            case "evening":
              return `eve-${c.categories.join("*")}`;
          }
        })
        .join("."),
    )
    .join("_");
}

/** Unknown or malformed pieces are dropped, never guessed. */
export function parseEdits(raw: string | string[] | null | undefined): EditBatch[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.length > 2000) return [];
  return value
    .split("_")
    .map((batch) => batch.split(".").flatMap((piece): EditCommand[] => parseCommand(piece)))
    .filter((batch) => batch.length > 0)
    .slice(0, 50);
}

function parseCommand(piece: string): EditCommand[] {
  const dash = piece.indexOf("-");
  const op = dash < 0 ? piece : piece.slice(0, dash);
  const arg = dash < 0 ? "" : piece.slice(dash + 1);
  if (op === "rm" && SHORT.test(arg)) return [{ op: "remove", id: osmIdFromShort(arg)! }];
  if (op === "add" || op === "mv") {
    const m = /^([nwrq]\d{1,12})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(arg);
    if (!m) return [];
    const command = { id: osmIdFromShort(m[1])!, day: Number(m[2]), ...(m[3] === undefined ? {} : { position: Number(m[3]) }) };
    return [op === "add" ? { op: "add", ...command } : { op: "move", ...command }];
  }
  if (op === "pace" && (PACES as string[]).includes(arg)) return [{ op: "pace", value: arg as Pace }];
  if (op === "eve") {
    const categories = arg.split("*").filter((c): c is EveningCategory => (EVENING_CATEGORIES as readonly string[]).includes(c));
    return categories.length ? [{ op: "evening", categories: [...new Set(categories)] }] : [];
  }
  return [];
}

/** The daytime stops of a built plan, per day: the starting point for edits on the deterministic plan. */
export function pinnedFromPlan(plan: Itinerary): string[][] {
  return plan.days.map((d) => d.stops.filter((s) => s.kind === "daytime").map((s) => s.id));
}

/**
 * Applies commands in order. A command naming a place the trip does not have (`known`), or a day that does not
 * exist, is skipped: the plan only ever holds places from the fetched list.
 */
export function applyEdits(start: PlanState, batches: readonly EditBatch[], known: ReadonlySet<string>): PlanState {
  const state: PlanState = { pinned: start.pinned.map((d) => [...d]), pace: start.pace, evening: [...start.evening] };
  const take = (id: string) => {
    for (const day of state.pinned) {
      const i = day.indexOf(id);
      if (i >= 0) day.splice(i, 1);
    }
  };
  for (const c of batches.flat()) {
    switch (c.op) {
      case "remove":
        take(c.id);
        break;
      case "add":
      case "move": {
        const day = state.pinned[c.day - 1];
        if (!day || !known.has(c.id)) break;
        take(c.id);
        day.splice(Math.min(c.position ?? day.length, day.length), 0, c.id);
        break;
      }
      case "pace":
        state.pace = c.value;
        break;
      case "evening":
        state.evening = [...c.categories];
        break;
    }
  }
  return state;
}

export type PlanDiff = {
  added: Array<{ name: string; day: number }>;
  removed: Array<{ name: string; day: number }>;
  moved: Array<{ name: string; from: number; to: number }>;
  /** Evening places that changed, by day. */
  evening: Array<{ day: number; from: string | null; to: string | null }>;
};

/** What a batch of edits changed, to show before "Geri al". */
export function diffPlans(before: Itinerary, after: Itinerary): PlanDiff {
  const daytime = (plan: Itinerary) =>
    new Map(plan.days.flatMap((d) => d.stops.filter((s) => s.kind === "daytime").map((s) => [s.id, { name: s.name, day: d.number }] as const)));
  const a = daytime(before);
  const b = daytime(after);
  const eveningOf = (plan: Itinerary, day: number) => plan.days.find((d) => d.number === day)?.stops.find((s) => s.kind === "evening")?.name ?? null;
  return {
    added: [...b].filter(([id]) => !a.has(id)).map(([, v]) => v),
    removed: [...a].filter(([id]) => !b.has(id)).map(([, v]) => v),
    moved: [...b].flatMap(([id, v]) => {
      const was = a.get(id);
      return was && was.day !== v.day ? [{ name: v.name, from: was.day, to: v.day }] : [];
    }),
    evening: after.days.flatMap((d) => {
      const from = eveningOf(before, d.number);
      const to = eveningOf(after, d.number);
      return from !== to ? [{ day: d.number, from, to }] : [];
    }),
  };
}
