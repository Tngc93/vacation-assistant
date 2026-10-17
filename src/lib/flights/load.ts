import "server-only";
import { cache } from "react";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/data/origins";
import { todayInIstanbul } from "@/lib/search/dates";
import { searchFlights } from "./search";

/**
 * Request-scoped flight search: the flights section and the budget use the
 * same result (and the same API calls). Arguments are primitives so React's
 * cache can match them.
 */
export const loadFlights = cache((from: string, to: string, depart: string, ret: string, pax: number, direct: boolean) =>
  searchFlights({
    origin: findOrigin(from)!,
    destination: findDestination(to)!,
    depart,
    return: ret,
    pax,
    direct,
    today: todayInIstanbul(new Date()),
  }),
);
