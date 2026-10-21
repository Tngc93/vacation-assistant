import type { Destination } from "@/data/destinations";
import { aiDemoEnabled } from "@/lib/ai/demo";
import { loadRateTable } from "@/lib/rates/table";
import { WebStaySearch } from "./WebStaySearch";

/** Rates for the lira estimates, then the client search (which shows nothing until AI is connected). */
export async function WebStaySection({ destination, checkIn, checkOut, adults }: { destination: Destination; checkIn: string; checkOut: string; adults: number }) {
  const rates = await loadRateTable(destination.currency);
  return (
    <WebStaySearch
      query={{ city: destination.nameEn, country: destination.countryCode, checkIn, checkOut, adults }}
      rates={rates}
      demo={aiDemoEnabled()}
    />
  );
}
