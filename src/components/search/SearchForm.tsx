"use client";

import { Plane } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button, Caption, Ticket } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { DEFAULT_ORIGIN, findOrigin, originAirportsLabel, type OriginCode } from "@/data/origins";
import { daysBetween, todayInIstanbul } from "@/lib/search/dates";
import { parseSearch, planHref, serializeSearch, type SearchDraft, type SearchField, type SearchIssue } from "@/lib/search/params";
import { DateRangeField } from "./DateRangeField";
import { DestinationCombobox } from "./DestinationCombobox";
import { OriginPicker } from "./OriginPicker";
import { PassengerStepper } from "./PassengerStepper";

export type SearchFormProps = {
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

/** The boarding-pass search: origin and destination codes update live on the ticket. */
export function SearchForm({ initial, initialIssues = [], today }: SearchFormProps) {
  const router = useRouter();
  const titleId = useId();
  const [from, setFrom] = useState<OriginCode>(initial?.from ?? DEFAULT_ORIGIN);
  const [to, setTo] = useState<string | undefined>(initial?.to);
  const [dates, setDates] = useState<{ depart?: string; return?: string }>({
    depart: initial?.depart,
    return: initial?.return,
  });
  const [pax, setPax] = useState(initial?.pax ?? 1);
  const [errors, setErrors] = useState<Errors>(() => toErrors(initialIssues));
  const [submitting, setSubmitting] = useState(false);

  const origin = findOrigin(from) ?? findOrigin(DEFAULT_ORIGIN)!;
  const destination = to ? findDestination(to) : undefined;
  const nights = dates.depart && dates.return ? daysBetween(dates.depart, dates.return) : null;

  const clearError = (...fields: SearchField[]) =>
    setErrors((current) => {
      if (!fields.some((f) => current[f])) return current;
      const next = { ...current };
      for (const f of fields) delete next[f];
      return next;
    });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft: SearchDraft = { from, to, depart: dates.depart, return: dates.return, pax };
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
    <form id="arama" onSubmit={onSubmit} noValidate aria-labelledby={titleId} className="scroll-mt-8">
      <h2 id={titleId} className="sr-only">
        Tatil araması
      </h2>
      <Ticket
        raised
        stub={
          <div className="flex h-full flex-col justify-between gap-5">
            <div>
              <Caption as="p">Özet</Caption>
              <p className="mt-1 font-mono text-body tabular text-ink" aria-live="polite">
                {nights ? `${nights} gece · ${pax} kişi` : `${pax} kişi`}
              </p>
            </div>
            <div
              aria-hidden="true"
              className="hidden h-10 w-full bg-[repeating-linear-gradient(90deg,var(--ink)_0_2px,transparent_2px_4px,var(--ink)_4px_5px,transparent_5px_9px)] opacity-80 md:block"
            />
            <div>
              {errorList.length ? (
                <div role="alert" className="mb-3 text-caption text-warn">
                  <p className="font-medium">Planı çıkarmak için:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {errorList.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Plan hazırlanıyor" : "Planı çıkar"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-4">
          <Caption>Biniş kartı</Caption>
          <Caption tone="accent">{destination ? `${destination.countryTr}` : "Rota seç"}</Caption>
        </div>

        <div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start md:gap-6">
          <div className="min-w-0">
            <Caption as="p">Nereden</Caption>
            <p aria-hidden="true" className="mt-1 truncate font-mono text-headline font-medium tabular tracking-tight text-ink">
              {originAirportsLabel(origin)}
            </p>
            <p className="mb-3 mt-1 text-caption text-ink-muted">{origin.nameTr}</p>
            <OriginPicker value={from} onChange={setFrom} />
          </div>

          <div aria-hidden="true" className="hidden w-24 items-center gap-2 pt-12 text-ink-muted md:flex lg:w-40">
            <span className="h-px flex-1 border-t border-dashed border-rule" />
            <Plane size={18} strokeWidth={1.5} />
            <span className="h-px flex-1 border-t border-dashed border-rule" />
          </div>

          <div className="min-w-0 md:text-right">
            <Caption as="p">Nereye</Caption>
            <p
              aria-hidden="true"
              className={`mt-1 truncate font-mono text-headline font-medium tabular tracking-tight ${destination ? "text-ink" : "text-rule"}`}
            >
              {destination ? destination.cityCode : "· · ·"}
            </p>
            <p className="mb-3 mt-1 truncate text-caption text-ink-muted">
              {destination ? `${destination.nameTr}, ${destination.countryTr}` : "Henüz seçilmedi"}
            </p>
            <DestinationCombobox
              value={to}
              onChange={(code) => {
                setTo(code);
                clearError("to");
              }}
              label="Varış şehri"
              error={errors.to}
              className="md:text-left"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 border-t border-rule pt-5 md:mt-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <DateRangeField
            value={dates}
            onChange={(next) => {
              setDates(next);
              clearError("depart", "return");
            }}
            departError={errors.depart}
            returnError={errors.return}
            today={today}
          />
          <div>
            <span aria-hidden="true" className="font-mono text-micro uppercase tracking-[0.08em] text-ink-muted">
              Yolcu
            </span>
            <PassengerStepper
              value={pax}
              onChange={(next) => {
                setPax(next);
                clearError("pax");
              }}
              className="mt-1"
            />
          </div>
        </div>
      </Ticket>
    </form>
  );
}
