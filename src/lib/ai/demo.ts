import "server-only";

/**
 * Keyless demo of the web search (VA_AI_MOCK=1, like VA_FLIGHTS_FIXTURES never on Vercel): the page uses the
 * mock provider's sample answers and labels every result "ÖRNEK VERİ".
 */
export function aiDemoEnabled(): boolean {
  return process.env.VA_AI_MOCK === "1" && !process.env.VERCEL;
}
