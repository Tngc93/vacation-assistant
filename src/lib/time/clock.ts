/** useSyncExternalStore subscriber that ticks at the start of every minute. */
export function subscribeMinute(callback: () => void) {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    callback();
    interval = setInterval(callback, 60_000);
  }, 60_000 - (Date.now() % 60_000));
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}
