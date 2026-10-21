import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { buttonClasses, Caption } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import { formatTicketDay } from "@/lib/flights/display";
import { daysBetween } from "@/lib/search/dates";
import { bookingUrl, GOOGLE_HOTELS_DEFAULT_GUESTS, googleHotelsUrl } from "@/lib/stays/links";

// Full width on phones and allowed to wrap, so a long label never widens the page.
const STAY_BUTTON = "w-full sm:w-auto";

type Props = {
  destination: Destination;
  checkIn: string;
  checkOut: string;
  adults: number;
  /** The web search by neighbourhood (only with AI connected). */
  children?: ReactNode;
};

/** Stay card (PRD 9–10): no price of our own, only prefilled searches on Booking and Google Hotels. */
export function StayCard({ destination, checkIn, checkOut, adults, children }: Props) {
  const search = { city: destination.nameEn, checkIn, checkOut, adults };
  const nights = daysBetween(checkIn, checkOut);
  return (
    <div className="rounded-md border border-rule bg-paper-raised px-5 py-6 md:px-8">
      <Caption as="p">
        {nights} GECE · {formatTicketDay(checkIn).toLocaleUpperCase("tr")} → {formatTicketDay(checkOut).toLocaleUpperCase("tr")} · {adults} KİŞİ
      </Caption>
      <p className="mt-3 max-w-2xl text-body">
        Ücretsiz bir otel fiyat kaynağı olmadığı için burada fiyat göstermiyoruz. {destination.nameTr} için tarihlerin dolu
        aramayı açıp gecelik fiyatı aşağıdaki bütçeye yazabilirsin.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={bookingUrl(search)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", wrap: true, className: STAY_BUTTON })}>
          Otelleri gör · Booking
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
        <a href={googleHotelsUrl(search)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", wrap: true, className: STAY_BUTTON })}>
          Otelleri gör · Google Hotels
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
      </div>
      {adults !== GOOGLE_HOTELS_DEFAULT_GUESTS ? (
        <p className="mt-3 text-caption text-ink-muted">
          Google Hotels kişi sayısını linkten almıyor; {adults} kişi için orada seçmen gerekiyor.
        </p>
      ) : null}
      {children}
    </div>
  );
}
