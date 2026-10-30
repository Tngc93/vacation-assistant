import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { buttonClasses, Caption } from "@/components/ui";
import { cityName, type Destination } from "@/data/destinations";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { formatTicketDay } from "@/lib/flights/display";
import { daysBetween } from "@/lib/search/dates";
import { bookingUrl, GOOGLE_HOTELS_DEFAULT_GUESTS, googleHotelsUrl } from "@/lib/stays/links";

// Full width on phones and allowed to wrap, so a long label never widens the page.
const STAY_BUTTON = "w-full sm:w-auto";

type Props = {
  locale?: Locale;
  destination: Destination;
  checkIn: string;
  checkOut: string;
  adults: number;
  /** Shown under the links (the "Web'de ara" toggle). */
  children?: ReactNode;
};

/** Stay card (PRD 9–10): no price of our own, only prefilled searches on Booking and Google Hotels. */
export function StayCard({ locale = "tr", destination, checkIn, checkOut, adults, children }: Props) {
  const { intl, m, f } = getI18n(locale);
  const search = { city: destination.nameEn, checkIn, checkOut, adults, locale };
  const nights = daysBetween(checkIn, checkOut);
  return (
    <div>
      <Caption as="p">
        {f(m.stays.summary, {
          nights,
          checkIn: formatTicketDay(checkIn, locale).toLocaleUpperCase(intl),
          checkOut: formatTicketDay(checkOut, locale).toLocaleUpperCase(intl),
          people: adults,
        })}
      </Caption>
      <p className="mt-3 max-w-2xl text-body">
        {f(m.stays.noPrice, { city: cityName(destination, locale) })}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={bookingUrl(search)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", wrap: true, className: STAY_BUTTON })}>
          {m.stays.booking}
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
        <a href={googleHotelsUrl(search)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", wrap: true, className: STAY_BUTTON })}>
          {m.stays.googleHotels}
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
      </div>
      {adults !== GOOGLE_HOTELS_DEFAULT_GUESTS ? (
        <p className="mt-3 text-caption text-ink-muted">
          {f(m.stays.googlePeople, { count: adults })}
        </p>
      ) : null}
      {children}
    </div>
  );
}
