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

- **Home hero** (replaced the boarding-pass search on 2026-10-22). The product opens as a planner, not a flight search: a short mono caption (the tagline), a large Fraunces question at the display size ("Nereye gidiyorsun?"), one muted line, then one raised strip with only the destination (country and city combobox), the date range and the accent "Planla" button; on desktop the three sit in one row, on mobile they stack and the button is full width. Under it a quiet inspiration row: "Keşfet:" in mono and six city chips we picked (not a measured popularity, so not "Popüler") (ink-filled when chosen); a chip picks the city and opens the calendar. No origin or passenger controls here: they belong to the plan's stay and flight sections. On desktop the hero sits a little above the middle of the first screen; the rest is paper.
- **City masthead** (now part of the plan hero, see below). Destination name in Fraunces, with a mono line underneath: coordinates, local time, currency and the TL exchange rate. A Wikimedia Commons photo (from Wikidata P18) sits beside it with photographer credit, in a duotone treatment that matches the palette.
- **Flight tickets.** Only in the plan's "Uçuşlar" section (under "Tüm uçuşları gör"). Each result is a small ticket: departure and arrival codes, times, stops, airline and price in mono. The cheapest has an accent price and a small "EN UCUZ" caption. Results are grouped by origin airport under hairline rules.
- **Visa stamp** (off the phase 1 plan page since 2026-10-21; the component stays). A circular, slightly rotated stamp-style badge ("VİZESİZ · 90 GÜN" in `--ok`, "VİZE GEREKLİ" in `--warn`), with the data date and the official link in a caption below. It must still read clearly at 0° for accessibility.
- **Budget receipt.** The TL total is laid out like a receipt: dotted leaders between each line and its amount, the source in a mono caption under each line, a double rule above the total.
- **Category chips.** Filters (see, museum, viewpoint, restaurant, café, cocktail bar, bar and pub, night club) are small square-cornered chips with a Lucide line icon. Selected chips are ink-filled, not accent-filled.
- **Itinerary.** Each day is headed by a huge Fraunces numeral ("01", "02") with the date in mono. Stops form a vertical timeline with times on the left and a hairline connector.
- **Sub-stop** ("Alt durak", 2026-10-23). A place inside a stop (the Tsar Bell and the Tsar Cannon in the Moscow Kremlin, the Raphael Rooms in the Vatican Museums) sits under that stop, inside its block: indented with its own hairline on the left, the name in the body size (regular, not medium), and one mono caption "MOSKOVA KREMLİNİ İÇİNDE · GÖRÜLECEK YER" (the parent's Turkish name). It has no number, no times and no walking line: it is seen during the parent's visit, whose duration already covers it. Its source link and "Çıkar" sit under it like a stop's; removing the parent removes its sub-stops too. In the places carousel such a card carries the same "… İÇİNDE" caption under its name, and on the map its dot is drawn a little off the parent's (about 40 m) when the two would sit on top of each other.
- **AI tab and side panel** ("Yapay zekâ sekmesi ve yan panel", 2026-10-22). The day-by-day plan comes first: under the section title sit the mono flight/time caption, "Takvime ekle (.ics)" and "Planı sıfırla", then the days; the AI panel never sits above them. The panel opens from a tab: on desktop (1024px and up) a secondary-style button right of the section title ("Yapay zekâ ile planla" with a Lucide Sparkles at 1.5px) and, while the plan section is on screen, a thin vertical tab stuck to the right edge (mono uppercase "YAPAY ZEKÂ"); both open it, the title button closes it again. On desktop the panel slides in from the right (about 420px, a sticky column; no animation with reduced motion) and is not modal: the days stay on the left, narrower (the day map moves under them), so a change shows live beside the panel. On phones the button is full width under the title and the panel is a full-screen sheet from the bottom; after a change is applied the sheet closes and the changed days are marked for a moment (paper-raised with an accent hairline). The close button, Escape and the tab close it; the focus moves into the panel and back to the tab. A small accent dot next to the closed tab marks a change the panel can summarise. The panel's content is unchanged (connect form or "Yapay zekâyla planla", the chat box, example chips, "Son değişiklik" and "Geri al", errors and the diagnostic caption). Its open state is never written to the URL.
- **Map.** MapLibre with an OpenFreeMap style recoloured to the palette: paper land, `--sea` water, muted roads, labels in Geist. Markers are small ink dots; the selected one becomes an accent dot with a label.

## Plan page layout

- **Plan hero (first screen).** On desktop the whole hero, under the site header, fits one viewport (`100svh` minus the header; checked at 1280×720, 1440×900, 1512×982). Left, about 7/12: the city name in Fraunces at the headline size (48, 32 on mobile), a mono info line (dates · nights · local time · TL rate · "Düzenle"; the people and the origin are chosen in the stay and flight sections, and "Düzenle" goes home with the city and the dates filled in), the category chips, then the places carousel filling the rest. Right, about 5/12: the Commons photo as a short duotone strip (16:7) with its credit, and the map filling the remaining height. On mobile: name, compact photo, the chips in one row that scrolls on its own (fading at the right edge), the carousel (the first card's top half on the first screen), then a 180px map strip that opens full screen on tap (close button and Escape). The hero is not printed.
- **Places carousel.** Scroll-snap, three cards at a time on desktop, one with the next card's edge on mobile; arrow buttons, keyboard arrows, a mono counter ("01 / 24"), the focus ring visible, no animation with reduced motion. A card is one button: the Commons photo over its top ~60% in the same duotone as the city photo (the credit is in the card's label and in the details, not on the card), with the rank in a small mono badge; without a photo, a large category icon and the Wikidata description (else the address) in that space, so every card has the same height; below, "MUTLAKA GÖR · 01" for sights, the name in Fraunces, the category, the walk to the centre ("MERKEZE 15 DK YÜRÜME") and today's hours ("BUGÜN AÇIK · 09:00–20:00"). Hover or selection draws the card's border and its map dot in accent; a dot picked on the map brings its card into view. The selected place's details open over the map (under the carousel on mobile). Chips filter the carousel and the map together.
- **Map stand-in.** Until the first interaction the map is the same places as dots on paper; MapLibre loads then, so the photo stays the first big paint.
- **In-page menu.** A thin sticky bar after the hero: "Yerler · Plan · Konaklama · Uçuşlar · Bütçe" in mono uppercase; the current section is underlined in ink (not accent). It scrolls sideways within itself on mobile.
- **Section order.** Hero, the day-by-day plan (the AI panel behind its tab, see "AI tab and side panel"), "Konaklama", "Uçuşlar", "Bütçe" last (the sum of the chosen flight, the stay and the daily spend).
- **"Konaklama".** The number of people on top (a mono "KİŞİ" label and the 1–9 stepper), then one quiet card with the Booking and Google Hotels links; "Web'de ara" (with an AI connection) opens under it at full width. Not printed.
- **"Uçuşlar".** On top, "KALKIŞ" (a segmented control: İstanbul · IST + SAW / Ankara · ESB) and the same "KİŞİ" stepper. Below, each airport's cheapest ticket as a quiet card (two side by side on desktop) with "Güncel fiyatı gör" and "Bütçeye ekle", the overall cheapest price in accent. "Tüm uçuşları gör" (closed by default) opens the full list, its non-stop filter and "Web'de ara" at the section's full width, so the tickets keep their wide layout and no time or duration wraps. Changing the origin or the people rewrites `?from=` / `?pax=` in place (no jump to the top) and the flights, the stay links and the budget follow.

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
