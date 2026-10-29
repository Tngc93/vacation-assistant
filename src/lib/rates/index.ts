import { cache } from "react";
import { getFixtureRate, rateFixturesEnabled } from "./fixtures";
import { getTryRate } from "./getRate";

/** Request-scoped, deduplicated rate lookup for Server Components (sample rates with VA_RATES_FIXTURES=1). */
export const getRate = cache((currency: string) => (rateFixturesEnabled() ? getFixtureRate(currency) : getTryRate(currency)));

export { formatCrossRate, formatRate, formatRateLine, formatRateSources, formatSourceDates } from "./format";
export { getTryRate, RATE_REVALIDATE_SECONDS, RATE_TIMEOUT_MS } from "./getRate";
export type { RateFound, RateMissing, RateResult, RateTable } from "./types";
export { SOURCES } from "./types";
