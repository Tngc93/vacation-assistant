/**
 * The gap between two of the plan's sections (DESIGN.md "Plan background"): the same height the sections' grid gap
 * had, with faint parallels and meridians full width and a small mono coordinate at the left edge ("41°23′ K"), on
 * paper so no line runs through it. Only here: nothing sits behind a section's content. Decoration only; in print
 * the gap stays and the lines go.
 */
export function SectionGap({ label }: { label: string }) {
  return (
    <div aria-hidden="true" data-section-gap="" className="relative h-16 md:h-20">
      <div className="plan-graticule print:hidden" />
      <span className="absolute left-0 top-1/2 -translate-y-1/2 bg-paper pr-2 font-mono text-[0.625rem] leading-none tracking-[0.08em] text-ink-muted tabular print:hidden">
        {label}
      </span>
    </div>
  );
}
