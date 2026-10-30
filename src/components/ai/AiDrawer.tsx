"use client";

import { useI18n } from "@/i18n/client";
import { Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The panel's id, for the tabs' aria-controls. */
export const AI_PANEL_ID = "yapay-zeka-panel";

/** DESIGN.md "AI tab and side panel": a side panel at 1024px and up, a full-screen sheet below. */
const DESKTOP = "(min-width: 64rem)";

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
}

type Drawer = {
  open: boolean;
  /** Opens the panel; `opener` gets the focus back when it closes. */
  show: (opener: HTMLElement | null) => void;
  /** Closes the panel and returns the focus to the tab that opened it (without scrolling to it). */
  close: () => void;
  toggle: (opener: HTMLElement | null) => void;
  /** A change the panel made that its summary shows: marked with a dot on the closed tabs. */
  changed: boolean;
  setChanged: (changed: boolean) => void;
};

function useDrawerState(): Drawer {
  const [open, setOpen] = useState(false);
  const [changed, setChanged] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const show = useCallback((el: HTMLElement | null) => {
    opener.current = el;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    const el = opener.current;
    // After the panel is hidden, so the focus does not land in a closing panel.
    requestAnimationFrame(() => el?.focus({ preventScroll: true }));
  }, []);
  const toggle = useCallback((el: HTMLElement | null) => (open ? close() : show(el)), [open, close, show]);
  return useMemo(() => ({ open, show, close, toggle, changed, setChanged }), [open, show, close, toggle, changed]);
}

const DrawerContext = createContext<Drawer | null>(null);

/** Shares the panel's state between the plan section's tabs and the plan. Not written to the URL. */
export function AiDrawerProvider({ children }: { children: ReactNode }) {
  return <DrawerContext value={useDrawerState()}>{children}</DrawerContext>;
}

/** The section's drawer, or a local one where the plan is rendered on its own (tests, the styleguide). */
export function useAiDrawer(): Drawer {
  const shared = useContext(DrawerContext);
  const local = useDrawerState();
  return shared ?? local;
}

function Dot({ show }: { show: boolean }) {
  return show ? (
    <>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
      <span className="sr-only">(yeni değişiklik)</span>
    </>
  ) : null;
}

/** "✦ Yapay zekâ ile planla" next to the plan section's title (full width under it on phones). */
export function AiTabButton() {
  const { m } = useI18n();
  const drawer = useAiDrawer();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={drawer.open}
      aria-controls={AI_PANEL_ID}
      onClick={() => drawer.toggle(ref.current)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && drawer.open) drawer.close();
      }}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border px-4 text-body font-medium transition-colors duration-150 ease-out lg:w-auto print:hidden",
        drawer.open ? "border-ink bg-ink text-paper-raised" : "border-ink text-ink hover:bg-ink hover:text-paper-raised",
      )}
    >
      <Sparkles aria-hidden="true" size={16} strokeWidth={1.5} />
      {m.ai.title}
      <Dot show={drawer.changed && !drawer.open} />
    </button>
  );
}

/**
 * A thin vertical tab stuck to the right edge while the plan section is on screen (desktop, panel closed): the
 * panel stays one click away while scrolling through the days.
 */
export function AiEdgeTab({ sectionId }: { sectionId: string }) {
  const { m } = useI18n();
  const drawer = useAiDrawer();
  const ref = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const section = document.getElementById(sectionId);
    if (!section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)));
    observer.observe(section);
    return () => observer.disconnect();
  }, [sectionId]);
  // Hidden rather than unmounted while the panel is open, so the focus can come back to this same button.
  const shown = inView && !drawer.open;
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={drawer.open}
      aria-controls={AI_PANEL_ID}
      aria-label={m.ai.open}
      aria-hidden={shown ? undefined : true}
      tabIndex={shown ? undefined : -1}
      onClick={() => drawer.show(ref.current)}
      className={cn(
        "fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 items-center gap-2 rounded-l-sm border border-r-0 border-ink bg-paper-raised px-1.5 py-3 font-mono text-micro uppercase tracking-[0.08em] text-ink shadow-ticket transition-colors duration-150 ease-out [writing-mode:vertical-rl] hover:bg-ink hover:text-paper-raised print:hidden",
        shown && "lg:flex",
      )}
    >
      <Sparkles aria-hidden="true" size={14} strokeWidth={1.5} />
      {m.ai.tab}
      <Dot show={drawer.changed} />
    </button>
  );
}
