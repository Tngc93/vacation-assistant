/** Placeholders in the sample responses under __fixtures__/, filled in for each request. */
export type FixtureDates = { depart?: string; return?: string; month?: string; returnMonth?: string };

/** Puts the requested dates into a sample response, so the samples work for any future trip. */
export function fillFixture<T>(data: T, dates: FixtureDates): T {
  let text = JSON.stringify(data);
  for (const [key, value] of Object.entries(dates)) if (value) text = text.replaceAll(`{${key}}`, value);
  return JSON.parse(text) as T;
}
