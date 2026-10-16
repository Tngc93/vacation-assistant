"use client";

import { Search } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { findDestination, type Destination } from "@/data/destinations";
import { cn } from "@/lib/cn";
import { searchDestinations } from "@/lib/search/normalize";

export type DestinationComboboxProps = {
  value: string | undefined;
  onChange: (cityCode: string | undefined) => void;
  label?: string;
  error?: string;
  className?: string;
};

function displayName(d: Destination | undefined): string {
  return d ? d.nameTr : "";
}

/**
 * Editable combobox with list autocomplete and automatic selection
 * (WAI-ARIA APG "combobox" pattern). Focus stays in the input; the active
 * option is exposed through aria-activedescendant.
 *
 * Keys: ↓/↑ open and move, Alt+↓ opens, Enter picks, Esc closes (or clears
 * when already closed), Tab leaves without changing the choice.
 */
export function DestinationCombobox({ value, onChange, label = "Nereye", error, className }: DestinationComboboxProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const selected = value ? findDestination(value) : undefined;

  const [query, setQuery] = useState(() => displayName(selected));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Show every city while the input still shows the current choice.
  const showingSelection = selected !== undefined && query === displayName(selected);
  const results = useMemo(() => searchDestinations(showingSelection ? "" : query), [query, showingSelection]);

  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    // Keep the text in step when the value changes from outside (e.g. the URL).
    setSyncedValue(value);
    setQuery(displayName(selected));
  }

  const optionId = (index: number) => `${id}-option-${index}`;

  const moveTo = (index: number) => {
    setActive(index);
    document.getElementById(optionId(index))?.scrollIntoView?.({ block: "nearest" });
  };

  const openList = (index: number) => {
    setOpen(true);
    if (results.length) moveTo(index);
  };

  const choose = (destination: Destination) => {
    onChange(destination.cityCode);
    setSyncedValue(destination.cityCode);
    setQuery(displayName(destination));
    setOpen(false);
    setActive(-1);
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
        if (!open) {
          const current = selected ? results.findIndex((r) => r.cityCode === selected.cityCode) : -1;
          openList(Math.max(current, 0));
        } else if (count) {
          moveTo((active + 1) % count);
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (event.altKey) {
          close();
        } else if (!open) {
          openList(count - 1);
        } else if (count) {
          moveTo(active <= 0 ? count - 1 : active - 1);
        }
        break;
      }
      case "Enter": {
        if (open && active >= 0 && results[active]) {
          event.preventDefault();
          choose(results[active]);
        }
        break;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          close();
        } else if (query) {
          event.preventDefault();
          setQuery("");
          onChange(undefined);
          setSyncedValue(undefined);
        }
        break;
      }
      case "Tab": {
        close();
        break;
      }
    }
  };

  const describedBy = error ? errorId : undefined;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-sm border bg-paper px-3 transition-colors duration-150 ease-out",
          "focus-within:border-ink",
          error ? "border-warn" : "border-rule",
        )}
      >
        <Search aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Şehir, ülke ya da kod"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(event.target.value.trim() ? 0 : -1);
          }}
          onKeyDown={onKeyDown}
          onClick={() => {
            if (!open) openList(-1);
          }}
          onBlur={() => {
            close();
            // Leaving the field restores the chosen city, or keeps the typed text for correction.
            if (selected) setQuery(displayName(selected));
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Varış şehirleri"
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-rule bg-paper-raised py-1 shadow-ticket"
      >
        {results.map((destination, index) => {
          const isActive = index === active;
          const isSelected = destination.cityCode === selected?.cityCode;
          return (
            <li
              key={destination.cityCode}
              id={optionId(index)}
              role="option"
              aria-selected={isActive}
              data-current={isSelected || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(destination)}
              onMouseMove={() => active !== index && setActive(index)}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2",
                isActive ? "bg-ink text-paper-raised" : "text-ink",
              )}
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{destination.nameTr}</span>
                <span className={cn("ml-2 text-caption", isActive ? "text-paper-raised" : "text-ink-muted")}>
                  {destination.countryTr}
                </span>
              </span>
              <span className="font-mono text-caption tabular tracking-[0.08em]">{destination.cityCode}</span>
            </li>
          );
        })}
        {results.length === 0 ? (
          <li role="presentation" className="px-3 py-2 text-caption text-ink-muted">
            Bu aramayla eşleşen şehir yok. Şehir, ülke ya da IATA koduyla dene.
          </li>
        ) : null}
      </ul>

      <p aria-live="polite" className="sr-only">
        {open ? (results.length ? `${results.length} şehir bulundu.` : "Eşleşen şehir yok.") : ""}
      </p>

      {error ? (
        <p id={errorId} className="mt-1.5 text-caption text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
