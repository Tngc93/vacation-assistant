import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CaptionTone = "muted" | "ink" | "accent" | "sea" | "ok" | "warn";

const tones: Record<CaptionTone, string> = {
  muted: "text-ink-muted",
  ink: "text-ink",
  accent: "text-accent",
  sea: "text-sea",
  ok: "text-ok",
  warn: "text-warn",
};

export type CaptionProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: CaptionTone;
};

/** Small mono uppercase label for sources, estimates and data headings. */
export function Caption({ as: Tag = "span", tone = "muted", className, ...props }: CaptionProps) {
  return (
    <Tag
      className={cn("font-mono text-micro tabular uppercase tracking-[0.08em]", tones[tone], className)}
      {...props}
    />
  );
}
