import { z } from "zod";

/**
 * One ticket from Aviasales Data API v3 `prices_for_dates`
 * (https://support.travelpayouts.com/hc/en-us/articles/203956163).
 * Times are ISO 8601 with the local offset of the airport; prices are in the
 * requested currency for one adult, as found in searches of the last 48 hours.
 */
export const apiTicketSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  origin_airport: z.string().regex(/^[A-Z]{3}$/),
  destination_airport: z.string().regex(/^[A-Z]{3}$/),
  price: z.number().positive(),
  airline: z.string().regex(/^[A-Z0-9]{2}$/),
  flight_number: z.union([z.string(), z.number()]).transform(String),
  departure_at: z.iso.datetime({ offset: true }),
  return_at: z.iso.datetime({ offset: true }).optional(),
  transfers: z.number().int().min(0),
  return_transfers: z.number().int().min(0).optional(),
  duration: z.number().int().positive().optional(),
  duration_to: z.number().int().positive().optional(),
  duration_back: z.number().int().positive().optional(),
  link: z.string().startsWith("/"),
});
export type ApiTicket = z.infer<typeof apiTicketSchema>;

/** The envelope: `success`, `data` (empty on error) and `error`. Tickets are checked one by one. */
const envelopeSchema = z.object({
  success: z.boolean(),
  // An array of tickets on success; the docs show `"data": {}` on errors.
  data: z.unknown().optional(),
  error: z.string().nullish(),
  currency: z.string().optional(),
});

export type ParsedResponse =
  | { ok: true; tickets: ApiTicket[]; dropped: number }
  | { ok: false; error: string };

/** Validates a response. A ticket that does not match the schema is dropped, never guessed at. */
export function parsePricesResponse(json: unknown): ParsedResponse {
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) return { ok: false, error: "unexpected response shape" };
  if (!envelope.data.success) return { ok: false, error: envelope.data.error || "success: false" };
  if (envelope.data.currency && envelope.data.currency.toLowerCase() !== "try") {
    return { ok: false, error: `unexpected currency ${envelope.data.currency}` };
  }
  const items = envelope.data.data ?? [];
  if (!Array.isArray(items)) return { ok: false, error: "unexpected response shape" };
  const tickets: ApiTicket[] = [];
  let dropped = 0;
  for (const item of items) {
    const ticket = apiTicketSchema.safeParse(item);
    if (ticket.success) tickets.push(ticket.data);
    else dropped++;
  }
  return { ok: true, tickets, dropped };
}
