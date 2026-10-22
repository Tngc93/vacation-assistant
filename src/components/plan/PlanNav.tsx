"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export const PLAN_NAV = [
  { id: "yerler", label: "Yerler" },
  { id: "gun-gun-plan", label: "Plan" },
  { id: "konaklama", label: "Konaklama" },
  { id: "ucuslar", label: "Uçuşlar" },
  { id: "butce", label: "Bütçe" },
] as const;

/**
 * A thin sticky in-page menu under the hero. The section crossing the upper part of the viewport is marked
 * (aria-current), the last one at the bottom of the page; on phones the menu scrolls sideways within itself.
 */
export function PlanNav() {
  const [active, setActive] = useState<string>(PLAN_NAV[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, boolean>();
    const update = () => {
      // The last section (the budget) may be too short to reach the band: at the bottom of the page it is current.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const current = atBottom ? PLAN_NAV[PLAN_NAV.length - 1] : PLAN_NAV.find((item) => visible.get(item.id));
      if (current) setActive(current.id);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        update();
      },
      // A band across the upper third of the screen decides which section is "current".
      { rootMargin: "-20% 0px -65% 0px" },
    );
    for (const item of PLAN_NAV) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <nav aria-label="Plan bölümleri" className="sticky top-0 z-30 -mx-4 border-b border-rule bg-paper px-4 md:-mx-8 md:px-8 print:hidden">
      <ul className="flex gap-6 overflow-x-auto [scrollbar-width:none]">
        {PLAN_NAV.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "-mb-px inline-block border-b py-3 font-mono text-micro uppercase tracking-[0.08em] no-underline transition-colors duration-150 ease-out",
                active === item.id ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
