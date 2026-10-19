import { describe, expect, it } from "vitest";
import { buildItinerary, type ItineraryInput } from "@/lib/itinerary/plan";
import { EVENING, SIGHTS } from "@/lib/itinerary/testCity";
import { applyEdits, diffPlans, encodeEdits, encodePinned, parseEdits, parsePinned, pinnedFromPlan, type EditBatch } from "./edits";

const input: ItineraryInput = {
  depart: "2026-11-14",
  return: "2026-11-18",
  timeZone: "Europe/Madrid",
  flight: null,
  daytime: SIGHTS,
  evening: EVENING,
  skip: [],
};
const known = new Set(SIGHTS.map((p) => p.id));

describe("edits in the URL", () => {
  it("round-trips an AI plan and chat edits, and never accepts anything but ids, days and known values", () => {
    const pinned = [[], ["node/100", "way/5", "wikidata/Q207870"], ["relation/9"], [], []];
    expect(encodePinned(pinned)).toBe("_n100.w5.q207870_r9__");
    expect(parsePinned(encodePinned(pinned))).toEqual(pinned);
    const batches: EditBatch[] = [
      [{ op: "remove", id: "node/100" }, { op: "add", id: "way/5", day: 3, position: 1 }],
      [{ op: "move", id: "node/101", day: 2 }, { op: "pace", value: "relaxed" }, { op: "evening", categories: ["cocktail", "pub"] }],
    ];
    expect(encodeEdits(batches)).toBe("rm-n100.add-w5-3-1_mv-n101-2.pace-relaxed.eve-cocktail*pub");
    expect(parseEdits(encodeEdits(batches))).toEqual(batches);
    expect(new URLSearchParams({ ai: encodePinned(pinned), edit: encodeEdits(batches) }).toString()).not.toContain("%");
    expect(parseEdits("rm-javascript:alert(1).pace-fast.eve-casino.add-n1-x_")).toEqual([]);
    expect(parsePinned("n1.<script>")).toBeNull();
  });
});

describe("applying edits", () => {
  const base = buildItinerary(input);
  const start = { pinned: pinnedFromPlan(base), pace: "normal" as const, evening: ["restaurant" as const] };

  it("removes, adds, moves, and changes pace and evening places, skipping places the trip does not have", () => {
    const day2 = start.pinned[1];
    const next = applyEdits(
      start,
      [
        [{ op: "remove", id: day2[0] }],
        [
          { op: "move", id: day2[1], day: 3, position: 0 },
          { op: "add", id: "node/999999", day: 2 },
          { op: "pace", value: "relaxed" },
          { op: "evening", categories: ["cocktail"] },
        ],
      ],
      known,
    );
    expect(next.pinned[1]).not.toContain(day2[0]);
    expect(next.pinned[2][0]).toBe(day2[1]);
    expect(next.pinned.flat()).not.toContain("node/999999");
    expect(next).toMatchObject({ pace: "relaxed", evening: ["cocktail"] });
    // The start state is untouched: undo is applying one batch fewer.
    expect(start.pinned[1][0]).toBe(day2[0]);
  });

  it("lets the engine time the edited plan, and shows what changed", () => {
    const removed = start.pinned[1][0];
    const after = applyEdits(start, [[{ op: "remove", id: removed }, { op: "pace", value: "relaxed" }]], known);
    const plan = buildItinerary({ ...input, pinned: after.pinned, pace: after.pace });
    expect(plan.days.every((d) => d.stops.filter((s) => s.kind === "daytime").length <= 4)).toBe(true);
    const diff = diffPlans(base, plan);
    expect(diff.removed.some((r) => r.name === SIGHTS.find((p) => p.id === removed)!.name)).toBe(true);
    expect(diffPlans(base, base)).toEqual({ added: [], removed: [], moved: [], evening: [] });
  });
});
