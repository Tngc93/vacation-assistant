"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, Chip } from "@/components/ui";
import { findDestination, DISCOVER_CITY_CODES } from "@/data/destinations";
import { DEFAULT_ORIGIN } from "@/data/origins";
import { todayInIstanbul } from "@/lib/search/dates";
import {
  DEFAULT_PASSENGERS,
  parseSearch,
  planHref,
  serializeSearch,
  type SearchDraft,
  type SearchField,
  type SearchIssue,
} from "@/lib/search/params";
import { DateRangeField, type DateRangeFieldHandle } from "./DateRangeField";
import { DestinationCombobox } from "./DestinationCombobox";

export type SearchFormProps = {
  /** A link's search (the plan's "Düzenle", a broken link); a non-default origin or group rides along unseen. */
  initial?: Partial<SearchDraft>;
  initialIssues?: SearchIssue[];
  /** Overrides "today" (Istanbul) — used by tests. */
  today?: string;
};

type Errors = Partial<Record<SearchField, string>>;

function toErrors(issues: SearchIssue[]): Errors {
  const errors: Errors = {};
  for (const issue of issues) errors[issue.field] ??= issue.message;
  return errors;
}

const fieldLabel = "font-mono text-micro uppercase tracking-[0.08em] text-ink-muted";

/**
 * The home page asks two things: where and when (DESIGN.md "Home hero"). The origin and the number of people
 * are chosen later, in the plan's stay and flight sections; "Planla" opens /plan?to=…&depart=…&return=….
 */
export function SearchForm({ initial, initialIssues = [], today }: SearchFormProps) {
  const router = useRouter();
  const titleId = useId();
  const datesRef = useRef<DateRangeFieldHandle>(null);
  const [to, setTo] = useState<string | undefined>(initial?.to);
  const [dates, setDates] = useState<{ depart?: string; return?: string }>({
    depart: initial?.depart,
    return: initial?.return,
  });
  const [errors, setErrors] = useState<Errors>(() => toErrors(initialIssues));
  const [submitting, setSubmitting] = useState(false);

  const clearError = (...fields: SearchField[]) =>
    setErrors((current) => {
      if (!fields.some((f) => current[f])) return current;
      const next = { ...current };
      for (const f of fields) delete next[f];
      return next;
    });

  const chooseCity = (code: string | undefined) => {
    setTo(code);
    clearError("to");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft: SearchDraft = {
      from: initial?.from ?? DEFAULT_ORIGIN,
      pax: initial?.pax ?? DEFAULT_PASSENGERS,
      to,
      depart: dates.depart,
      return: dates.return,
    };
    const result = parseSearch(new URLSearchParams(serializeSearch(draft)), today ?? todayInIstanbul(new Date()));
    if (!result.ok) {
      setErrors(toErrors(result.issues));
      return;
    }
    setErrors({});
    setSubmitting(true);
    router.push(planHref(result.value));
  };

  const errorList = Object.values(errors);

  return (
    <div>
      <form
        id="arama"
        onSubmit={onSubmit}
        noValidate
        aria-labelledby={titleId}
        className="scroll-mt-8 rounded-md border border-rule bg-paper-raised p-4 shadow-ticket md:p-5"
      >
        <h2 id={titleId} className="sr-only">
          Şehir ve tarihler
        </h2>
        <div className="grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_auto] md:items-start md:gap-4">
          <div className="min-w-0">
            <span aria-hidden="true" className={fieldLabel}>
              Nereye
            </span>
            <DestinationCombobox value={to} onChange={chooseCity} label="Varış şehri" error={errors.to} className="mt-1" />
          </div>
          <DateRangeField
            ref={datesRef}
            value={dates}
            onChange={(next) => {
              setDates(next);
              clearError("depart", "return");
            }}
            departError={errors.depart}
            returnError={errors.return}
            today={today}
          />
          <div className="md:pt-[1.125rem]">
            <Button type="submit" size="lg" className="w-full md:h-11 md:w-auto" disabled={submitting}>
              {submitting ? "Plan hazırlanıyor" : "Planla"}
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
            </Button>
          </div>
        </div>
        {errorList.length ? (
          <div role="alert" className="mt-4 border-t border-rule pt-3 text-caption text-warn">
            <p className="font-medium">Planı çıkarmak için:</p>
            <ul className="mt-1 list-inside list-disc">
              {errorList.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id={`${titleId}-discover`} className={fieldLabel}>
          Keşfet:
        </span>
        <ul aria-labelledby={`${titleId}-discover`} className="flex flex-wrap gap-2">
          {DISCOVER_CITY_CODES.map((code) => {
            const city = findDestination(code)!;
            return (
              <li key={code}>
                <Chip
                  selected={to === code}
                  onClick={() => {
                    chooseCity(code);
                    datesRef.current?.open();
                  }}
                >
                  {city.nameTr}
                </Chip>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
