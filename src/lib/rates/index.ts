import { cache } from "react";
import { getTryRate } from "./getRate";

/** Request-scoped, deduplicated rate lookup for Server Components. */
export const getRate = cache((currency: string) => getTryRate(currency));

export { formatRate, formatRateLine } from "./format";
export { getTryRate, RATE_REVALIDATE_SECONDS, RATE_TIMEOUT_MS } from "./getRate";
export type { RateFound, RateMissing, RateResult } from "./types";
export { SOURCES } from "./types";
