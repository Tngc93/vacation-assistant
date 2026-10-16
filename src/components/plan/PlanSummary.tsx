import Link from "next/link";
import { buttonClasses, Caption, Ticket } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { findOrigin, originAirportsLabel } from "@/data/origins";
import { formatDay } from "@/lib/format";
import { daysBetween, isoToDate } from "@/lib/search/dates";
import { editHref, type SearchState } from "@/lib/search/params";

/** Small boarding pass summarising the current search, with an edit link. */
export function PlanSummary({ search }: { search: SearchState }) {
  const origin = findOrigin(search.from)!;
  const destination = findDestination(search.to)!;
  const nights = daysBetween(search.depart, search.return);

  return (
    <Ticket
      stubBeside="sm"
      aria-label="Seçilen rota"
      stub={
        <div className="flex h-full flex-col justify-between gap-3">
          <div>
            <Caption as="p">Süre</Caption>
            <p className="mt-1 font-mono text-body tabular text-ink">
              {nights} gece · {search.pax} kişi
            </p>
          </div>
          <Link href={editHref(search)} className={buttonClasses({ variant: "secondary", className: "w-full no-underline" })}>
            Düzenle
          </Link>
        </div>
      }
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <Caption as="p">Nereden</Caption>
          <p className="mt-1 truncate font-mono text-title tabular tracking-tight">{originAirportsLabel(origin)}</p>
          <p className="text-caption text-ink-muted">{origin.nameTr}</p>
        </div>
        <span aria-hidden="true" className="mb-6 hidden h-px flex-1 border-t border-dashed border-rule sm:block" />
        <div className="min-w-0 text-right">
          <Caption as="p">Nereye</Caption>
          <p className="mt-1 font-mono text-title tabular tracking-tight">{destination.cityCode}</p>
          <p className="truncate text-caption text-ink-muted">
            {destination.nameTr}, {destination.countryTr}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-rule pt-4">
        <div>
          <Caption as="dt">Gidiş</Caption>
          <dd className="mt-1 font-mono text-caption tabular sm:text-body">{formatDay(isoToDate(search.depart))}</dd>
        </div>
        <div>
          <Caption as="dt">Dönüş</Caption>
          <dd className="mt-1 font-mono text-caption tabular sm:text-body">{formatDay(isoToDate(search.return))}</dd>
        </div>
      </dl>
    </Ticket>
  );
}
