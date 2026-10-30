import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A quiet placeholder block in --rule. Decorative: pair it with a status label. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-rule", className)}
      {...props}
    />
  );
}

/** Ticket-shaped loading state used for result lists. */
export function SkeletonTicket({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn("rounded-md border border-rule bg-paper-raised p-5", className)}>
      <span className="sr-only">{label}</span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-px flex-1" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}
