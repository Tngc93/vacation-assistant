import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  selected?: boolean;
  icon?: ReactNode;
};

/** Square-cornered filter toggle. Selected chips are ink-filled, never accent-filled. */
export function Chip({ selected = false, icon, className, children, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-caption font-medium",
        "transition-[background-color,color,border-color] duration-150 ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-ink bg-ink text-paper-raised"
          : "border-rule bg-paper-raised text-ink hover:border-ink",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
