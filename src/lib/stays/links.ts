/**
 * Hotel searches on other sites, as plain links (no API). Checked in a
 * browser on 2026-10-17:
 * - Booking fills the city, both dates, adults and one room.
 * - Google Hotels fills the city and both dates from the query text; it does
 *   not take a guest count from the URL (it starts at 2).
 */
export type StaySearch = {
  /** English city name, as both sites recognise it ("Barcelona"). */
  city: string;
  /** YYYY-MM-DD */
  checkIn: string;
  checkOut: string;
  adults: number;
};

export function bookingUrl(search: StaySearch): string {
  const params = new URLSearchParams({
    ss: search.city,
    checkin: search.checkIn,
    checkout: search.checkOut,
    group_adults: String(search.adults),
    group_children: "0",
    no_rooms: "1",
  });
  return `https://www.booking.com/searchresults.html?${params}`;
}

/** The guest count Google Hotels opens with; any other count has to be chosen there. */
export const GOOGLE_HOTELS_DEFAULT_GUESTS = 2;

export function googleHotelsUrl(search: Omit<StaySearch, "adults">): string {
  const params = new URLSearchParams({
    q: `hotels in ${search.city} from ${search.checkIn} to ${search.checkOut}`,
    hl: "tr",
    curr: "TRY",
  });
  return `https://www.google.com/travel/search?${params}`;
}
