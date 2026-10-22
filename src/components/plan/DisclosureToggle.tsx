"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Opens a panel below a section's main content ("Tüm uçuşları gör", "Web'de ara"); not printed. */
export function DisclosureToggle({ open, controls, onClick, children }: { open: boolean; controls: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-1.5 text-caption font-medium text-ink print:hidden"
    >
      <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} className={cn("transition-transform duration-200", open && "rotate-180")} />
      {children}
    </button>
  );
}
