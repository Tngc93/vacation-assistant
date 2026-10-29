import { ExternalLink } from "lucide-react";
import { Caption, Stamp } from "@/components/ui";
import { countryName, type Destination } from "@/data/destinations";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { isoToDate } from "@/lib/search/dates";
import { describeVisa } from "@/lib/visa/describe";
import { getVisaInfo, MFA_VISA_URL, VISA_DATA } from "@/lib/visa";

/** Visa stamp for an ordinary (burgundy) Turkish passport, with source and the official link. */
export function VisaCard({ destination, locale = "tr" }: { destination: Destination; locale?: Locale }) {
  const i18n = getI18n(locale);
  const { intl, m, f } = i18n;
  const visa = getVisaInfo(destination.countryCode);
  const view = describeVisa(visa.requirement, countryName(destination, locale), i18n);
  const dataDate = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" }).format(
    isoToDate(VISA_DATA.source.dataDate),
  );

  return (
    <div className="flex flex-col gap-6 rounded-md border border-rule bg-paper-raised p-5 sm:flex-row sm:items-center md:gap-10 md:p-8">
      <Stamp label={view.label} detail={view.detail} tone={view.tone} className="self-center sm:self-auto" />
      <div className="min-w-0 flex-1">
        <p className="text-heading font-medium text-ink">{view.sentence}</p>
        <Caption as="p" className="mt-3">
          {f(m.visa.passport, { date: dataDate })}
        </Caption>
        <p className="mt-2 text-caption text-ink-muted">
          {m.visa.otherPassports}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <a
            href={MFA_VISA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-body font-medium text-sea underline"
          >
            {m.visa.official}
            <ExternalLink aria-hidden="true" size={14} strokeWidth={1.5} />
            <span className="sr-only">{m.common.newTab}</span>
          </a>
          <Caption as="p">
            {m.visa.source}{" "}
            <a href={VISA_DATA.source.repository} target="_blank" rel="noopener noreferrer" className="underline">
              {VISA_DATA.source.name}
            </a>{" "}
            · {VISA_DATA.source.license}
          </Caption>
        </div>
      </div>
    </div>
  );
}
