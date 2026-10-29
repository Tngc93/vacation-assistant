"use client";

import { PlaneTakeoff } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { originAirportsLabel, originAirportsShort, type OriginOption } from "@/data/origins";
import { cn } from "@/lib/cn";

export type OriginComboboxProps = {
  value: OriginOption;
  onChange: (origin: OriginOption) => void;
  className?: string;
  "aria-busy"?: boolean;
};

/** Debounce for typing; the answers are cached (here and by the browser). */
const SEARCH_DELAY_MS = 150;

type Answer = { status: "ok"; results: OriginOption[] } | { status: "error" };
const answers = new Map<string, Answer>();

export async function fetchOrigins(query: string, signal?: AbortSignal): Promise<Answer> {
  const key = query.trim().toLocaleLowerCase("tr");
  const known = answers.get(key);
  if (known) return known;
  try {
    const res = await fetch(`/api/origins?${new URLSearchParams({ q: key })}`, { signal });
    if (!res.ok) return { status: "error" };
    const json = (await res.json()) as { results?: OriginOption[] };
    const answer: Answer = { status: "ok", results: Array.isArray(json.results) ? json.results : [] };
    answers.set(key, answer);
    return answer;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    return { status: "error" };
  }
}

/**
 * "Kalkış": the same editable combobox as the destination (WAI-ARIA APG "combobox", list autocomplete), over
 * every city with an airport. The list lives on the server; each keystroke asks `/api/origins?q=` (debounced),
 * so the ~3,500 cities never ship to the browser.
 *
 * Keys: ↓/↑ open and move, Alt+↓ opens, Enter picks, Esc closes (or restores the current city), Tab leaves without
 * changing the choice.
 */
export function OriginCombobox({ value, onChange, className, "aria-busy": busy }: OriginComboboxProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;

  const [query, setQuery] = useState(value.name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [answer, setAnswer] = useState<(Answer & { term: string }) | null>(null);

  const [syncedCode, setSyncedCode] = useState(value.code);
  if (syncedCode !== value.code) {
    // The server resolved a new origin (or the URL changed): show its name.
    setSyncedCode(value.code);
    setQuery(value.name);
  }

  // Popular cities while the input still shows the current choice.
  const term = query === value.name ? "" : query;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        fetchOrigins(term, controller.signal).then(
          (next) => {
            setAnswer({ ...next, term });
            if (next.status === "ok") setActive((a) => (term.trim() ? 0 : Math.min(a, next.results.length - 1)));
          },
          () => {},
        );
      },
      term ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, term]);

  const results = answer?.status === "ok" ? answer.results : [];
  // Enter picks only from the answer to what is typed now, never from the list of a shorter query.
  const fresh = answer?.term === term;
  const optionId = (index: number) => `${id}-option-${index}`;

  const moveTo = (index: number) => {
    setActive(index);
    document.getElementById(optionId(index))?.scrollIntoView?.({ block: "nearest" });
  };

  const choose = (origin: OriginOption) => {
    setQuery(origin.name);
    setOpen(false);
    setActive(-1);
    if (origin.code !== value.code) onChange(origin);
  };

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) setOpen(true);
        else if (count) moveTo((active + 1) % count);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (event.altKey) close();
        else if (!open) setOpen(true);
        else if (count) moveTo(active <= 0 ? count - 1 : active - 1);
        break;
      }
      case "Enter": {
        if (open && fresh && active >= 0 && results[active]) {
          event.preventDefault();
          choose(results[active]);
        }
        break;
      }
      case "Escape": {
        event.preventDefault();
        if (open) close();
        else setQuery(value.name);
        break;
      }
      case "Tab": {
        close();
        break;
      }
    }
  };

  const status = !open
    ? ""
    : answer === null
      ? ""
      : answer.status === "error"
        ? "Şehir listesi şu an alınamadı."
        : results.length
          ? `${results.length} şehir bulundu.`
          : "Eşleşen şehir yok.";

  return (
    <div className={cn("relative min-w-0", className)} aria-busy={busy}>
      <label htmlFor={inputId} className="font-mono text-micro uppercase tracking-[0.08em] text-ink-muted">
        Kalkış
      </label>
      <div
        className={cn(
          "mt-1.5 flex h-11 items-center gap-2 rounded-sm border border-rule bg-paper px-3 transition-colors duration-150 ease-out",
          "focus-within:border-ink field-focus-ring",
        )}
      >
        <PlaneTakeoff aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 && results[active] ? optionId(active) : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Şehir, ülke ya da kod"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          onClick={() => setOpen(true)}
          // Typing replaces the current city instead of adding to its name.
          onFocus={(event) => event.target.select()}
          onBlur={() => {
            close();
            // Leaving the field without a choice keeps the current city.
            setQuery(value.name);
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
        />
        <span aria-hidden="true" className="shrink-0 font-mono text-caption tabular tracking-[0.04em] text-ink-muted">
          {originAirportsShort(value)}
        </span>
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Kalkış şehirleri"
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-rule bg-paper-raised py-1 shadow-ticket"
      >
        {results.map((origin, index) => {
          const isActive = index === active;
          return (
            <li
              key={origin.code}
              id={optionId(index)}
              role="option"
              aria-selected={isActive}
              data-current={origin.code === value.code || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(origin)}
              onMouseMove={() => active !== index && setActive(index)}
              className={cn("flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2", isActive ? "bg-ink text-paper-raised" : "text-ink")}
            >
              <span className="min-w-0">
                <span className="block truncate">
                  <span className="font-medium">{origin.name}</span>
                  <span className={cn("ml-2 text-caption", isActive ? "text-paper-raised" : "text-ink-muted")}>{origin.countryTr}</span>
                </span>
                {origin.airports.length > 1 ? (
                  <span className={cn("block font-mono text-micro tabular tracking-[0.04em]", isActive ? "text-paper-raised" : "text-ink-muted")}>
                    {originAirportsLabel(origin)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-mono text-caption tabular tracking-[0.08em]">{origin.code}</span>
            </li>
          );
        })}
        {answer?.status === "ok" && results.length === 0 ? (
          <li role="presentation" className="px-3 py-2 text-caption text-ink-muted">
            Bu aramayla eşleşen şehir yok. Şehir, ülke ya da IATA koduyla dene.
          </li>
        ) : null}
        {answer?.status === "error" ? (
          <li role="presentation" className="px-3 py-2 text-caption text-warn">
            Şehir listesi şu an alınamadı. Biraz sonra yeniden dene.
          </li>
        ) : null}
      </ul>

      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
