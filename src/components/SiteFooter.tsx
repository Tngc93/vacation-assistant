import { Caption } from "@/components/ui";
import { BRAND_NAME, BRAND_TAGLINE, REPO_URL } from "@/lib/brand";

type Source = { links: ReadonlyArray<{ name: string; href: string }>; terms: string };

/** Where the data comes from and under which terms (README "Veri kaynakları ve atıflar" has the details). */
const SOURCES: ReadonlyArray<Source> = [
  { links: [{ name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright" }], terms: "Mekânlar · ODbL" },
  { links: [{ name: "Wikidata", href: "https://www.wikidata.org" }], terms: "Şehirler, önem sırası · CC0" },
  { links: [{ name: "Wikimedia Commons", href: "https://commons.wikimedia.org" }], terms: "Fotoğraflar · her birinin kendi lisansı" },
  {
    links: [
      { name: "Travelpayouts", href: "https://www.travelpayouts.com" },
      { name: "Aviasales", href: "https://www.aviasales.com" },
    ],
    terms: "Uçuş fiyatları · önbellekten, tahmini",
  },
  {
    links: [
      { name: "TCMB", href: "https://www.tcmb.gov.tr/kurlar/today.xml" },
      { name: "Frankfurter", href: "https://frankfurter.dev" },
      { name: "open.er-api", href: "https://www.exchangerate-api.com" },
    ],
    terms: "Döviz kurları",
  },
  { links: [{ name: "passport-index-data", href: "https://github.com/imorte/passport-index-data" }], terms: "Vize verisi · MIT" },
];

const LINK = "text-ink underline decoration-rule hover:decoration-ink";

export function SiteFooter() {
  return (
    <footer className="border-t border-rule print:hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-12 md:gap-8 md:px-8 md:py-16">
        <div className="md:col-span-5">
          <p className="font-display text-heading tracking-tight text-ink">{BRAND_NAME}</p>
          <p className="mt-1 text-caption text-ink-muted">{BRAND_TAGLINE}</p>
          <p className="mt-6 max-w-sm text-caption text-ink">
            Fiyatlar tahminidir; satın almadan önce sağlayıcıda doğrula.
          </p>
          <p className="mt-2 max-w-sm text-caption text-ink-muted">
            Ziyaretler çerezsiz ve anonim sayılır (Vercel Web Analytics); plan içeriğin ölçülmez.
          </p>
        </div>
        <div className="md:col-span-7">
          <Caption as="h2">Veri kaynakları</Caption>
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
                <Caption>{source.terms}</Caption>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-4 py-5 md:px-8">
        <Caption>
          Açık kaynak ·{" "}
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
            MIT lisansı
          </a>
        </Caption>
      </div>
    </footer>
  );
}
