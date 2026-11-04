import { Caption } from "@/components/ui";
import type { Locale } from "@/i18n/locales";
import { getI18n, type Messages } from "@/i18n/server";
import { BRAND_NAME, REPO_URL } from "@/lib/brand";

type Source = { links: ReadonlyArray<{ name: string; href: string }>; terms: keyof Messages["footer"] };

/** Where the data comes from and under which terms (README "Veri kaynakları ve atıflar" has the details). */
const SOURCES: ReadonlyArray<Source> = [
  { links: [{ name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright" }], terms: "places" },
  { links: [{ name: "Wikidata", href: "https://www.wikidata.org" }], terms: "wikidata" },
  { links: [{ name: "OurAirports", href: "https://ourairports.com/data/" }], terms: "ourAirports" },
  { links: [{ name: "GeoNames", href: "https://www.geonames.org" }], terms: "geoNames" },
  { links: [{ name: "Wikimedia Commons", href: "https://commons.wikimedia.org" }], terms: "commons" },
  {
    links: [
      { name: "Travelpayouts", href: "https://www.travelpayouts.com" },
      { name: "Aviasales", href: "https://www.aviasales.com" },
    ],
    terms: "flights",
  },
  {
    links: [
      { name: "TCMB", href: "https://www.tcmb.gov.tr/kurlar/today.xml" },
      { name: "Frankfurter", href: "https://frankfurter.dev" },
      { name: "open.er-api", href: "https://www.exchangerate-api.com" },
    ],
    terms: "rates",
  },
  { links: [{ name: "passport-index-data", href: "https://github.com/imorte/passport-index-data" }], terms: "visa" },
];

const LINK = "text-ink underline decoration-rule hover:decoration-ink";

export function SiteFooter({ locale }: { locale: Locale }) {
  const { m } = getI18n(locale);
  return (
    <footer className="border-t border-rule print:hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-12 md:gap-8 md:px-8 md:py-16">
        <div className="md:col-span-5">
          <p className="font-display text-heading tracking-tight text-ink">{BRAND_NAME}</p>
          <p className="mt-1 text-caption text-ink-muted">{m.brand.tagline}</p>
          <p className="mt-6 max-w-sm text-caption text-ink">{m.footer.estimates}</p>
          <p className="mt-2 max-w-sm text-caption text-ink-muted">{m.footer.analytics}</p>
          {/* Installing is the browser's own flow; this only says where to find it. */}
          <details className="mt-6 max-w-sm">
            <summary className={`cursor-pointer text-caption ${LINK}`}>{m.pwa.install}</summary>
            <p className="mt-2 text-caption text-ink-muted">{m.pwa.installLead}</p>
            <ul className="mt-2 grid gap-1 text-caption text-ink">
              <li>{m.pwa.installIos}</li>
              <li>{m.pwa.installAndroid}</li>
            </ul>
          </details>
        </div>
        <div className="md:col-span-7">
          <Caption as="h2">{m.footer.sources}</Caption>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {SOURCES.map((source) => (
              <li key={source.terms} className="flex min-w-0 flex-col gap-0.5">
                <span className="text-caption">
                  {source.links.map((link, i) => (
                    <span key={link.name}>
                      {i > 0 ? <span className="text-ink-muted"> · </span> : null}
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                        {link.name}
                      </a>
                    </span>
                  ))}
                </span>
                <Caption>{m.footer[source.terms]}</Caption>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-4 py-5 md:px-8">
        <Caption>
          {m.footer.openSource} ·{" "}
          {/* lang="en": the Turkish uppercase would print "GİTHUB". */}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" lang="en" className={LINK}>
            GitHub
          </a>{" "}
          ·{" "}
          <a
            href={`${REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer license"
            className={LINK}
          >
            {m.footer.license}
          </a>
        </Caption>
      </div>
    </footer>
  );
}
