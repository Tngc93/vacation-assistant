import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/** End-to-end checks against the production build (`npm run build` first). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // External sources (rates, Overpass, Wikidata, Commons) fail fast, so pages
    // render their "not available" states deterministically and without network.
    // Flights use the labelled sample responses (no token, no network).
    env: { VA_OFFLINE: "1", VA_FLIGHTS_FIXTURES: "1" },
  },
});
