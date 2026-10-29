"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: ReadonlyArray<{ value: ThemePreference; Icon: LucideIcon }> = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
];

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

/** Three-way theme switch: follow the system, or force light / dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { m } = useI18n();
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);

  const select = useCallback((value: ThemePreference) => {
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
  }, []);

  return (
    <div
      role="group"
      aria-label={m.theme.group}
      className={cn("inline-flex items-center gap-0.5 rounded-sm border border-rule bg-paper-raised p-0.5", className)}
    >
      {OPTIONS.map(({ value, Icon }) => {
        const label = m.theme[value];
        const pressed = preference === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            title={label}
            onClick={() => select(value)}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-sm transition-colors duration-150 ease-out",
              pressed ? "bg-ink text-paper-raised" : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}
