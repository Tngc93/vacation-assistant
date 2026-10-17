/**
 * The fetch used by every server-side data source. With VA_OFFLINE=1 (set
 * only for the end-to-end test server) external sources fail immediately,
 * so tests are fast, deterministic and show the "not available" states.
 */
export const externalFetch: typeof fetch = (input, init) =>
  process.env.VA_OFFLINE === "1"
    ? Promise.reject(new Error("offline (VA_OFFLINE=1)"))
    : fetch(input, init);

/**
 * Like `AbortSignal.timeout`, but built on `setTimeout`, so tests can drive it
 * with fake timers instead of waiting on the real clock. Aborts with a
 * "TimeoutError" DOMException, the same reason `AbortSignal.timeout` uses.
 */
export function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("The operation timed out.", "TimeoutError")), ms);
  // Never keep a server process alive just for a timeout.
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  return controller.signal;
}
