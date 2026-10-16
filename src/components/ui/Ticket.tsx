import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Breakpoint = "sm" | "md";

export type TicketProps = HTMLAttributes<HTMLElement> & {
  /** The stub: sits beside the body on wide screens and drops below on mobile. */
  stub?: ReactNode;
  /** Applies the soft "raised ticket" shadow. */
  raised?: boolean;
  /** Breakpoint from which the stub sits beside the body. */
  stubBeside?: Breakpoint;
};

// Tailwind only sees complete class names, so every breakpoint variant is spelled out.
const layout: Record<Breakpoint, { row: string; stub: string; line: string; start: string; end: string }> = {
  sm: {
    row: "sm:flex-row",
    stub: "sm:w-56 sm:shrink-0",
    line: "sm:h-auto sm:w-0 sm:self-stretch",
    start: "sm:left-0 sm:-top-px sm:-translate-x-1/2 sm:-translate-y-1/2 sm:[clip-path:inset(50%_0_0_0)]",
    end: "sm:right-auto sm:left-0 sm:top-auto sm:-bottom-px sm:-translate-x-1/2 sm:translate-y-1/2 sm:[clip-path:inset(0_0_50%_0)]",
  },
  md: {
    row: "md:flex-row",
    stub: "md:w-64 md:shrink-0",
    line: "md:h-auto md:w-0 md:self-stretch",
    start: "md:left-0 md:-top-px md:-translate-x-1/2 md:-translate-y-1/2 md:[clip-path:inset(50%_0_0_0)]",
    end: "md:right-auto md:left-0 md:top-auto md:-bottom-px md:-translate-x-1/2 md:translate-y-1/2 md:[clip-path:inset(0_0_50%_0)]",
  },
};

const dash: Record<Breakpoint, string> = {
  sm: "sm:inset-x-0 sm:inset-y-4 sm:border-t-0 sm:border-l",
  md: "md:inset-x-0 md:inset-y-4 md:border-t-0 md:border-l",
};

/**
 * A paper ticket with a perforated divider: a dashed rule with two
 * half-circle notches cut out of the edges (filled with the page colour).
 * Notches are clipped with clip-path rather than overflow, so popovers
 * inside the ticket (listbox, calendar) are not cut off.
 */
export function Ticket({ stub, raised = false, stubBeside = "md", className, children, ...props }: TicketProps) {
  const l = layout[stubBeside];
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-md border border-rule bg-paper-raised text-ink",
        l.row,
        raised && "shadow-ticket",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 p-5 md:p-8">{children}</div>
      {stub ? (
        <>
          <div aria-hidden="true" data-slot="perforation" className={cn("relative h-0 w-full", l.line)}>
            <span className={cn("absolute inset-x-5 top-0 border-t border-dashed border-rule", dash[stubBeside])} />
            <span
              className={cn(
                "absolute -left-px top-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-rule bg-paper [clip-path:inset(0_0_0_50%)]",
                l.start,
              )}
            />
            <span
              className={cn(
                "absolute -right-px top-0 size-5 translate-x-1/2 -translate-y-1/2 rounded-full border border-rule bg-paper [clip-path:inset(0_50%_0_0)]",
                l.end,
              )}
            />
          </div>
          <div className={cn("p-5 md:p-8", l.stub)}>{stub}</div>
        </>
      ) : null}
    </article>
  );
}
