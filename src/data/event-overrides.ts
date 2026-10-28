/**
 * Hand-kept exceptions to the event rules (src/lib/events/wikidata.ts): events Wikidata still describes as
 * recurring, but which are no longer held. Each entry names its Wikidata item and says why in one line;
 * `npm run data:events` leaves them out. Remove an entry once Wikidata marks the end (P576, P582 or P2669), which
 * the rules then read on their own.
 */
export type EventExclusion = { qid: string; name: string; reason: string };

export const EVENT_EXCLUSIONS: Readonly<Record<string, readonly EventExclusion[]>> = {
  DXB: [
    { qid: "Q3070706", name: "Dubai International Film Festival", reason: "discontinued after the 2017 edition; no end date on Wikidata" },
    { qid: "Q1158900", name: "Dubai Desert Rock Festival", reason: "last held in 2009; no end date on Wikidata" },
  ],
  LON: [{ qid: "Q1252830", name: "River Thames frost fairs", reason: "historic fairs on the frozen Thames, the last in 1814; typed as a Christmas market" }],
  ROM: [{ qid: "Q477741", name: "Matralia", reason: "an ancient Roman festival, not held today; no country (P17) on Wikidata to rule it out" }],
};
