import { cn } from "@/lib/cn";

/** Each code is a small ticket stub on its own paper, like the carousel's rank badge: readable over the atmosphere. */
const CODE = "tabular rounded-sm border border-rule bg-paper-raised px-1.5 py-0.5 text-[0.75rem] leading-none";

/**
 * The thin strip under the site header (DESIGN.md "Plan background"): the origin's code, a dashed `--accent` route
 * and the destination's code ("IST · BCN"). The route draws once when the page opens and stays; a new origin
 * (`?from=`, chosen in "Uçuşlar") brings a new line, drawn again (the key). With reduced motion it is there at
 * once. Decoration only: the flight section names the origin in words. Not printed.
 */
export function RouteStrip({ from, to, className }: { from: string; to: string; className?: string }) {
  const sameCity = from === to;
  return (
    <div
      aria-hidden="true"
      data-route-strip=""
      data-from={from}
      data-to={to}
      className={cn("plan-route relative z-[1] flex items-center gap-3 font-mono text-micro uppercase tracking-[0.08em] text-ink print:hidden", className)}
    >
      <span className={CODE}>{from}</span>
      {sameCity ? null : (
        <span key={`${from}-${to}`} className="relative flex flex-1 items-center">
          <span className="size-1.5 shrink-0 rounded-full border border-ink" />
          <span data-route-line="" className="plan-route-line flex-1" />
          <span className="plan-route-end size-1.5 shrink-0 rounded-full bg-accent" />
        </span>
      )}
      {sameCity ? null : <span className={CODE}>{to}</span>}
    </div>
  );
}
