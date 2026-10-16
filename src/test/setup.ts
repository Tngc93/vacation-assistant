import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

// Tests never touch the network: real sources are replaced by fixtures and fake fetchers.
globalThis.fetch = (input: RequestInfo | URL) =>
  Promise.reject(new Error(`Network access in tests is not allowed: ${String(input)}`));

afterEach(() => {
  cleanup();
});
