import { cn } from "@/lib/cn";

export type StampTone = "ok" | "sea" | "warn" | "muted";

const tones: Record<StampTone, string> = {
  ok: "text-ok",
  sea: "text-sea",
  warn: "text-warn",
  muted: "text-ink-muted",
};

export type StampProps = {
  /** Main line, e.g. "VİZESİZ". */
  label: string;
  /** Optional second line, e.g. "90 GÜN". */
  detail?: string;
  tone?: StampTone;
  /** Slight rotation for the printed look. Content stays legible at 0°. */
  tilted?: boolean;
  className?: string;
};

/** Circular passport-stamp badge for visa status. */
export function Stamp({ label, detail, tone = "ok", tilted = true, className }: StampProps) {
  return (
    <div
      role="img"
      aria-label={detail ? `${label}, ${detail}` : label}
      className={cn(
        "relative inline-flex size-32 shrink-0 flex-col items-center justify-center rounded-full",
        "border-2 border-current text-center font-mono uppercase",
        tilted && "-rotate-6",
        tones[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-1.5 rounded-full border border-current opacity-60" />
      <span aria-hidden="true" className="px-3 text-caption font-semibold leading-tight tracking-[0.12em]">
        {label}
      </span>
      {detail ? (
        <>
          <span aria-hidden="true" className="my-1 h-px w-12 bg-current opacity-60" />
          <span aria-hidden="true" className="tabular text-caption font-medium tracking-[0.12em]">
            {detail}
          </span>
        </>
      ) : null}
    </div>
  );
}
