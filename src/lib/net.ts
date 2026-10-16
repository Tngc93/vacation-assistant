/**
 * The fetch used by every server-side data source. With VA_OFFLINE=1 (set
 * only for the end-to-end test server) external sources fail immediately,
 * so tests are fast, deterministic and show the "not available" states.
 */
export const externalFetch: typeof fetch = (input, init) =>
  process.env.VA_OFFLINE === "1"
    ? Promise.reject(new Error("offline (VA_OFFLINE=1)"))
    : fetch(input, init);
