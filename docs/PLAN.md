# Build plan

One step = one branch = one PR. Ask Berk before opening each PR. Steps 0–9 are done (phase 1 went live on 2026-10-23); later work is listed under "Lansman sonrası". PRD numbers refer to `docs/PRD.md`; the visual rules are in `docs/DESIGN.md`.

| # | Branch | Scope | PRD |
| --- | --- | --- | --- |
| 0 | `main` | Repository setup: git, AGENTS.md, CLAUDE.md, docs, GitHub repo | — |
| 1 | `feat/scaffold-design-system` | Next.js + TypeScript strict + Tailwind + ESLint + Vitest + CI; design tokens, fonts, grain, light/dark theme, base components (Button, Chip, Ticket, Caption, Skeleton) and a `/styleguide` page | — |
| 2 | `feat/search` | Boarding-pass search: origin (Istanbul → IST+SAW, Ankara → ESB), country and city, dates, passengers; state in the URL. *Replaced by the plan-first home page (PR #18): the home page asks only where and when.* | 1–3 |
| 3 | `feat/visa-and-rates` | Turkish-passport visa stamp from passport-index-dataset (read at build time); TCMB rates server-side with daily cache and Frankfurter fallback | 11–12, 14 |
| 4 | `feat/city-guide` | City masthead (Wikidata + Commons photo with credit), Overpass places with category chips, "must-see" ranking via Wikidata sitelinks, MapLibre + OpenFreeMap map in the palette | 16–19 |
| 5 | `feat/flights` | Travelpayouts server route, results grouped by airport, direct-only filter, prefilled deep links; a clear message when the token is missing | 4–7 |
| 6 | `feat/budget-and-stays` | Budget receipt in TL with editable daily spend; stay card with Booking and Google Hotels deep links | 9–10, 13, 15 |
| 7 | `feat/itinerary` | Deterministic day-by-day plan by proximity (max 4 stops + 1 evening place per day). *Now time-based: up to 6 stops until 18:00, then one evening place; 4 stops only at the "relaxed" pace.* | 20 |
| 8a | `feat/ai-connect` | Provider-agnostic AI layer (Anthropic, OpenAI, Gemini) called from the browser, with zod validation, one retry and a mock provider; connect screen with the key kept in the browser; AI itinerary limited to fetched places; chat edits as commands (URL, diff, undo); Content-Security-Policy | 21–26 |
| 8b | `feat/ai-web-search` | "Search the web" for flight and hotel prices; neighbourhood suggestions for the stay | 8, 9 |
| 9 | `chore/launch` ✅ | Done 2026-10-23: footer (sources and licences), Open Graph cards, robots and sitemap, 404 and error pages, axe and keyboard e2e, Lighthouse pass, README with screenshots and live link, `docs/DEPLOY.md` | — |

## Lansman sonrası

PRs after the launch step, in merge order (an open one last). #17–#19 merged just before the launch PR (#20), on the same two days.

| PR | Branch | Merged | Scope |
| --- | --- | --- | --- |
| #17 | `chore/brand-vacationist` | 2026-10-22 | Interface brand "Vacationist" with the tagline "Kısa şehir kaçamakları için planlayıcı"; repo and package keep `vacation-assistant` |
| #18 | `feat/plan-first-flow` | 2026-10-22 | Plan-first flow: the home page asks only where and when ("Nereye gidiyorsun?", "Keşfet" cities); `from` and `pax` optional; plan order hero → day-by-day plan → stays → flights → budget; the combined "Bilet ve konaklama" section removed |
| #19 | `feat/ai-side-panel` | 2026-10-23 | The plan comes first; the AI panel behind a tab (side panel on desktop, bottom sheet on phones) |
| #20 | `chore/launch` | 2026-10-23 | Step 9: footer, Open Graph cards, robots and sitemap, axe and keyboard e2e, Lighthouse, README, `docs/DEPLOY.md` |
| #21 | `chore/domain-vacationist` | 2026-10-23 | Live address https://vacationist-app.vercel.app; `SITE_URL` as a constant |
| #22 | `chore/analytics` | 2026-10-23 | Vercel Web Analytics, production only, path without query, no custom events |
| #23 | `feat/place-containment` | 2026-10-27 | Places inside another place (Wikidata P361/P276) visit with it as sub-stops |
| #24 | `feat/far-from-center` | 2026-10-28 | Far from the centre by one rule ("MERKEZE ~X KM"), far areas in the plan, tourist centres, Latin-name preference |
| #25 | `feat/cocktail-bars` | 2026-10-28 | Cocktail bars from Wikidata, joined to OSM bars and pubs |
| #26 | `feat/events` | 2026-10-28 | Big yearly events from Wikidata: "Etkinlik" chip, masthead line, day notes; adult content excluded |
| #27 | `feat/romanized-names` | 2026-10-28 | Non-Latin names romanized with each country's official system; "Moskova Kremlini" override |
| #28 | `fix/e2e-keyboard-flaky` | 2026-10-29 | Carousel arrows `aria-disabled` at either end (focus no longer lost; flaky keyboard e2e fixed) |
| #29 | `chore/final-review` | 2026-10-29 | Final review after launch: README (About line, screenshots), PRD/PLAN/AGENTS/DEPLOY/DESIGN, map shield warnings dropped, whole-flow e2e |
| #30 | `feat/any-origin` | 2026-10-29 (squash) | Any city as the origin: departure cities from OurAirports (public domain), Turkish names from Wikidata, time zones from GeoNames; IATA metro codes (`metros.ts`); `/api/origins` server search and the "Kalkış" combobox; remembered origin (`localStorage`); same-city and empty states; airline names from Wikidata (P229). No Travelpayouts-derived file in the repo (its first version had one, hence the squash) |
| #31 | `feat/currency` | 2026-10-29 (squash) | Budget currency picker (TRY, EUR, USD, GBP; default TRY, EUR for the coming English UI): every amount converted through TRY with BigInt, `?cur=` labels the amounts in the link (none = TRY, older links unchanged), remembered in `localStorage`; source line under the receipt; masthead rate line in the budget's currency; web-search prices and "Bütçeye ekle/yaz" in it; `VA_RATES_FIXTURES` sample rates for e2e |
| — | `feat/i18n-en` | — (açık) | English interface under `/en` (Turkish stays at the root): every UI text in `src/i18n/messages/` (tr, en, same keys), TR / EN switch keeping the query, hreflang/canonical/two-language sitemap and OG; English names (Wikidata EN → Latin local → romanized → local), English descriptions, cities, countries, origins, airports, events and airlines; `en-GB` formats; EUR budget default in English; AI replies in the interface language |
