import { ExternalLink } from "lucide-react";
import { Caption, Stamp } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import { isoToDate } from "@/lib/search/dates";
import { describeVisa } from "@/lib/visa/describe";
import { getVisaInfo, MFA_VISA_URL, VISA_DATA } from "@/lib/visa";

const dataDateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

/** Visa stamp for an ordinary (burgundy) Turkish passport, with source and the official link. */
export function VisaCard({ destination }: { destination: Destination }) {
  const visa = getVisaInfo(destination.countryCode);
  const view = describeVisa(visa.requirement, destination.countryTr);
  const dataDate = dataDateFormat.format(isoToDate(VISA_DATA.source.dataDate));

  return (
    <div className="flex flex-col gap-6 rounded-md border border-rule bg-paper-raised p-5 sm:flex-row sm:items-center md:gap-10 md:p-8">
      <Stamp label={view.label} detail={view.detail} tone={view.tone} className="self-center sm:self-auto" />
      <div className="min-w-0 flex-1">
        <p className="text-heading font-medium text-ink">{view.sentence}</p>
        <Caption as="p" className="mt-3">
          Bordo (umuma mahsus) pasaport · Veri: {dataDate}
        </Caption>
        <p className="mt-2 text-caption text-ink-muted">
          Yeşil (hususi), gri (hizmet) ve diplomatik pasaportlarda kurallar farklı olabilir.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <a
            href={MFA_VISA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-body font-medium text-sea underline"
          >
            Resmî bilgi: T.C. Dışişleri Bakanlığı
            <ExternalLink aria-hidden="true" size={14} strokeWidth={1.5} />
            <span className="sr-only">(yeni sekmede açılır)</span>
          </a>
          <Caption as="p">
            Kaynak:{" "}
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
