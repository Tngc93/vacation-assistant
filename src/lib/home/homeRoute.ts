/**
 * What the home page's search wants drawn on the route map: the city chosen in "Nereye" and the "Keşfet" chip under
 * the pointer or the focus. The form writes, the map (loaded later, when the browser is idle) reads the latest value
 * and follows changes. A module-level store, so the form never waits for the map and works without it.
 */
import type { Wanted } from "./routes";

let state: Wanted = { selected: null, preview: null };
const listeners = new Set<() => void>();

export function getHomeRoute(): Wanted {
  return state;
}

export function setHomeRoute(patch: Partial<Wanted>): void {
  const next = { ...state, ...patch };
  if (next.selected === state.selected && next.preview === state.preview) return;
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeHomeRoute(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
