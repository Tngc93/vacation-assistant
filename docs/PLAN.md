# Build plan

One step = one branch = one PR. Ask Berk before opening each PR. PRD numbers refer to `docs/PRD.md`; the visual rules are in `docs/DESIGN.md`.

| # | Branch | Scope | PRD |
| --- | --- | --- | --- |
| 0 | `main` | Repository setup: git, AGENTS.md, CLAUDE.md, docs, GitHub repo | — |
| 1 | `feat/scaffold-design-system` | Next.js + TypeScript strict + Tailwind + ESLint + Vitest + CI; design tokens, fonts, grain, light/dark theme, base components (Button, Chip, Ticket, Caption, Skeleton) and a `/styleguide` page | — |
| 2 | `feat/search` | Boarding-pass search: origin (Istanbul → IST+SAW, Ankara → ESB), country and city, dates, passengers; state in the URL | 1–3 |
| 3 | `feat/visa-and-rates` | Turkish-passport visa stamp from passport-index-dataset (read at build time); TCMB rates server-side with daily cache and Frankfurter fallback | 11–12, 14 |
| 4 | `feat/city-guide` | City masthead (Wikidata + Commons photo with credit), Overpass places with category chips, "must-see" ranking via Wikidata sitelinks, MapLibre + OpenFreeMap map in the palette | 16–19 |
| 5 | `feat/flights` | Travelpayouts server route, results grouped by airport, direct-only filter, prefilled deep links; a clear message when the token is missing | 4–7 |
| 6 | `feat/budget-and-stays` | Budget receipt in TL with editable daily spend; stay card with Booking and Google Hotels deep links | 9–10, 13, 15 |
| 7 | `feat/itinerary` | Deterministic day-by-day plan by proximity (max 4 stops + 1 evening place per day) | 20 |
| 8a | `feat/ai-connect` | Provider-agnostic AI layer (Anthropic, OpenAI, Gemini) called from the browser, with zod validation, one retry and a mock provider; connect screen with the key kept in the browser; AI itinerary limited to fetched places; chat edits as commands (URL, diff, undo); Content-Security-Policy | 21–26 |
| 8b | `feat/ai-web-search` | "Search the web" for flight and hotel prices; neighbourhood suggestions for the stay | 8, 9 |
| 9 | `chore/launch` | Vercel deploy guide, README with screenshots, live link, Lighthouse and accessibility pass | — |
| 10 | `feat/plan-first-flow` | Plan-first flow (Berk, 2026-10-22): the home page asks only where and when ("Nereye gidiyorsun?", destination, dates, "Planla", six "Keşfet" cities); `from` and `pax` optional in the URL (İstanbul, 1 person); plan page order hero → day-by-day plan → stays (people) → flights (origin, people; full list under "Tüm uçuşları gör") → budget; the combined "Bilet ve konaklama" section removed | 1–3, 9–10 |
