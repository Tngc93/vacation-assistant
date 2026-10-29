import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom has no matchMedia; components treat the viewport as narrow.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom does not lay out pages, so it has no scrollIntoView.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

// Tests never touch the network: real sources are replaced by fixtures and fake fetchers. The one exception is
// the opt-in live check of the price API (src/lib/flights/live.test.ts: only with a token, never in CI), which
// passes this to the code under test as its fetcher.
(globalThis as { __vaNetworkFetch?: typeof fetch }).__vaNetworkFetch ??= globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL) =>
  Promise.reject(new Error(`Network access in tests is not allowed: ${String(input)}`));

// VA_TEST_NOW pins the clock for a whole run (CI runs the suite at several
// times of day). A test that depends on the time sets its own with
// vi.setSystemTime, so the result must be the same at any pinned moment.
const pinnedNow = process.env.VA_TEST_NOW;
if (pinnedNow) {
  if (Number.isNaN(Date.parse(pinnedNow))) throw new Error(`VA_TEST_NOW is not a date: ${pinnedNow}`);
  beforeEach(() => {
    vi.setSystemTime(new Date(pinnedNow));
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
