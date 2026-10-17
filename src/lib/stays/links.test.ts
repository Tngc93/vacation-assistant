import { describe, expect, it } from "vitest";
import { bookingUrl, googleHotelsUrl } from "./links";

const search = { city: "Barcelona", checkIn: "2026-11-14", checkOut: "2026-11-18", adults: 3 };

describe("hotel search links", () => {
  it("opens Booking with the city, dates, adults and one room", () => {
    const url = new URL(bookingUrl(search));
    expect(url.origin + url.pathname).toBe("https://www.booking.com/searchresults.html");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ss: "Barcelona",
      checkin: "2026-11-14",
      checkout: "2026-11-18",
      group_adults: "3",
      group_children: "0",
      no_rooms: "1",
    });
  });

  it("opens Google Hotels with the city and dates in the query, in Turkish and lira", () => {
    const url = new URL(googleHotelsUrl(search));
    expect(url.origin + url.pathname).toBe("https://www.google.com/travel/search");
    expect(url.searchParams.get("q")).toBe("hotels in Barcelona from 2026-11-14 to 2026-11-18");
    expect(url.searchParams.get("hl")).toBe("tr");
    expect(url.searchParams.get("curr")).toBe("TRY");
  });
});
