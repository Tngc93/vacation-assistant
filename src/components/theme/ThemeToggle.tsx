"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const ICONS: Record<ThemePreference, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };

/** Each press moves one step: system → light → dark → system. */
export const NEXT_THEME: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyThemePreference(readPreference());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * One icon button for the theme: the icon shows the mode it is in now (system, light, dark), each press moves to
 * the next one. Its name and tooltip say both ("Tema: Sistem. Basınca: Açık"); after a press the new mode is also
 * read out from a polite status, since not every screen reader announces a focused button's new name.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { m, f } = useI18n();
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const [announced, setAnnounced] = useState("");

  const cycle = useCallback(() => {
    const value = NEXT_THEME[readPreference()];
    try {
      if (value === "system") {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, value);
      }
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this page.
    }
    applyThemePreference(value);
    listeners.forEach((listener) => listener());
    setAnnounced(f(m.theme.changed, { current: m.theme[value] }));
  }, [f, m]);

  const Icon = ICONS[preference];
  const label = f(m.theme.toggle, { current: m.theme[preference], next: m.theme[NEXT_THEME[preference]] });
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        data-theme-preference={preference}
        onClick={cycle}
        className={cn(
          "touch-target inline-flex size-9 items-center justify-center rounded-sm border border-rule bg-paper-raised text-ink transition-colors duration-150 ease-out hover:border-ink",
          className,
        )}
      >
        <Icon aria-hidden="true" size={16} strokeWidth={1.5} />
      </button>
      <span role="status" className="sr-only">
        {announced}
      </span>
    </>
  );
}
