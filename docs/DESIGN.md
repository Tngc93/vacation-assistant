# Design direction: "Travel journal"

Premium and niche, not a booking site. The reference is an independent travel magazine crossed with a boarding pass: warm paper, sharp ink, generous whitespace, one confident accent colour. Every screen should feel printed and calm, never busy or salesy.

## Principles

1. **Typography first.** Large serif headlines carry the character. Photos and colour support them; they don't carry the page.
2. **One accent.** Use the accent only for the main action, the selected state and the cheapest price. Everything else is ink on paper.
3. **Data reads like a ticket.** Airport codes, times, prices and coordinates use the mono font with tabular figures, so numbers line up.
4. **Honest labels look good.** "Estimated" and source labels are small, mono, uppercase captions, and part of the design rather than an afterthought.
5. **Quiet motion.** 150–250 ms ease-out, no bounce, no parallax. Respect `prefers-reduced-motion`.

## Tokens

Define these as CSS variables in `app/globals.css` and map them into the Tailwind theme. Components never use raw hex values.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#F4EFE6` | `#0F1216` | page background |
| `--paper-raised` | `#FBF8F2` | `#171B21` | cards, tickets |
| `--ink` | `#16181D` | `#EDE7DC` | text, primary lines |
| `--ink-muted` | `#6B665E` | `#9C958A` | secondary text, captions |
| `--rule` | `#D9D1C3` | `#2A2F37` | hairline borders (1px) |
| `--accent` | `#B8492A` (terracotta) | `#E07650` | primary action, selection, best price |
| `--accent-ink` | `#FBF8F2` | `#0F1216` | text on accent |
| `--sea` | `#1F5560` | `#6FA8B3` | map water, info states, links |
| `--ok` | `#3F6B45` | `#86B98C` | visa-free, success |
| `--warn` | `#8F6210`¹ | `#D9A441` | visa needed, estimate warnings |

¹ Originally `#9A6A12`, which is only 4.13:1 on `--paper`. Darkened to `#8F6210` (4.67:1) to meet the WCAG AA quality bar below.

- Radius: 4px for inputs and chips, 6px for cards. No pill-shaped cards, no `rounded-2xl`.
- Shadows: none, or one very soft shadow for raised tickets (`0 1px 0 var(--rule), 0 8px 24px -16px rgb(0 0 0 / .25)`).
- Background grain: a subtle SVG noise overlay on `--paper` at about 3–4% opacity, disabled in print and when reduced motion or transparency is requested.
- Spacing: 4px base. Section gaps of at least 64px on desktop.

## Type

Load all fonts via `next/font/google` (no external requests at runtime).

| Role | Font | Notes |
| --- | --- | --- |
| Display | **Fraunces** (variable, use the `opsz` and `SOFT` axes) | City names, section titles, big day numerals. Tight tracking at large sizes. |
| UI and body | **Geist** | Everything else. 15–16px body, 1.5 line height. |
| Data | **Geist Mono** | IATA codes, times, prices, coordinates, source captions. `font-variant-numeric: tabular-nums`. |

Scale (desktop): 72 / 48 / 32 / 22 / 16 / 13. On mobile the top two steps become 44 / 32.

## Signature components

- **Boarding-pass search.** The home screen hero is a single large ticket: origin codes on the left (`IST · SAW` or `ESB`), destination code on the right, dates and passengers below, a perforated divider (dashed rule with two half-circle notches cut out of the edges) and the search button on the stub. On mobile the stub drops below.
- **City masthead.** Destination name in very large Fraunces, with a mono line underneath: coordinates, local time, currency and the TL exchange rate. A Wikimedia Commons photo (from Wikidata P18) sits beside it with photographer credit, in a duotone treatment that matches the palette.
- **Flight tickets.** Each result is a small ticket: departure and arrival codes, times, stops, airline and price in mono. The cheapest has an accent price and a small "EN UCUZ" caption. Results are grouped by origin airport under hairline rules.
- **Visa stamp.** A circular, slightly rotated stamp-style badge ("VİZESİZ · 90 GÜN" in `--ok`, "VİZE GEREKLİ" in `--warn`), with the data date and the official link in a caption below. It must still read clearly at 0° for accessibility.
- **Budget receipt.** The TL total is laid out like a receipt: dotted leaders between each line and its amount, the source in a mono caption under each line, a double rule above the total.
- **Category chips.** Filters (see, museum, viewpoint, restaurant, café, cocktail bar, bar and pub, night club) are small square-cornered chips with a Lucide line icon. Selected chips are ink-filled, not accent-filled.
- **Itinerary.** Each day is headed by a huge Fraunces numeral ("01", "02") with the date in mono. Stops form a vertical timeline with times on the left and a hairline connector.
- **Map.** MapLibre with an OpenFreeMap style recoloured to the palette: paper land, `--sea` water, muted roads, labels in Geist. Markers are small ink dots; the selected one becomes an accent dot with a label.

## Don't

- No purple or blue-to-pink gradients, no glassmorphism, no neon.
- No emoji as icons; use Lucide line icons at 1.5px stroke.
- No stock "happy traveller" photos, no illustrations of suitcases and planes.
- Don't leave shadcn/ui or Tailwind defaults visible: restyle any component to these tokens.
- No dense dashboards. If a screen feels busy, remove things rather than shrinking them.

## Quality bar

- Design mobile first at 375px, then check at 768px and 1280px. No horizontal scroll.
- WCAG AA contrast in both themes; visible focus ring (2px `--accent`, 2px offset); everything keyboard-reachable.
- Turkish formatting with `Intl` and the `tr-TR` locale: `12.450 ₺`, `14 Kas Cum`, 24-hour times.
- Loading states are skeleton tickets in `--rule`, never spinners in the middle of the page.
- Empty and error states are written as one calm sentence plus one action, in the same editorial voice.
