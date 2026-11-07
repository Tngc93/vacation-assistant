import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Caption } from "@/components/ui";
import { languageAlternates } from "@/i18n/alternates";
import { PRIVACY_PATH, type Locale } from "@/i18n/locales";
import { getI18n, type Messages } from "@/i18n/server";
import { REPO_URL } from "@/lib/brand";

/** The day the page last matched the code (2026-11-07: checked against analytics, storage, the CSP and sw.js). */
export const PRIVACY_UPDATED = "2026-11-07";

export function privacyMetadata(locale: Locale): Metadata {
  const { m } = getI18n(locale);
  return { title: m.privacy.title, description: m.privacy.description, alternates: languageAlternates(locale, PRIVACY_PATH) };
}

type Privacy = Messages["privacy"];
type StorageText = keyof Privacy["storage"];

/** What the browser keeps, by the key the code uses (src/lib/theme.ts, budget/currency.ts, data/origins.ts, ai/, public/sw.js). */
export const PRIVACY_STORAGE: ReadonlyArray<{ group: StorageText; entries: ReadonlyArray<{ key: string; text: StorageText }> }> = [
  {
    group: "local",
    entries: [
      { key: "va-theme", text: "theme" },
      { key: "va.currency", text: "currency" },
      { key: "va.origin", text: "origin" },
      { key: "va.ai.connection", text: "aiRemembered" },
    ],
  },
  {
    group: "session",
    entries: [
      { key: "va.ai.connection", text: "aiSession" },
      { key: "va.web.v1.…", text: "webSearch" },
      { key: "va.gemini25.unavailable", text: "gemini" },
    ],
  },
  {
    group: "caches",
    entries: [
      { key: "va-plans", text: "plans" },
      { key: "va-media", text: "media" },
      { key: "va-static-…", text: "static" },
    ],
  },
];

/** Every outside service a visit touches, named as the footer names them. */
const PARTIES: ReadonlyArray<{ names: readonly string[]; text: Exclude<keyof Privacy["parties"], "title" | "lead" | "data"> }> = [
  { names: ["Vercel"], text: "vercel" },
  { names: ["OpenFreeMap"], text: "openFreeMap" },
  { names: ["Wikimedia Commons"], text: "commons" },
  { names: ["Travelpayouts", "Aviasales"], text: "flights" },
  { names: ["Booking", "Google Hotels", "Google Flights"], text: "links" },
  { names: ["TCMB", "Frankfurter", "Exchange Rate API"], text: "rates" },
  { names: ["Anthropic", "OpenAI", "Google Gemini"], text: "ai" },
];

const LINK = "text-ink underline decoration-rule underline-offset-4 hover:decoration-ink";
// wrap-anywhere: host names (generativelanguage.googleapis.com) would otherwise widen a 320px phone.
const PROSE = "max-w-prose text-body text-ink wrap-anywhere";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-rule pt-8 md:pt-10">
      <h2 id={`${id}-title`} className="font-display text-title text-ink">
        {title}
      </h2>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function Paragraphs({ items }: { items: readonly string[] }) {
  return items.map((text) => (
    <p key={text} className={PROSE}>
      {text}
    </p>
  ));
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="grid max-w-prose list-disc gap-2 pl-5 text-body text-ink marker:text-ink-muted">
      {items.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}

/**
 * The privacy page (/gizlilik, /en/privacy): plain and editorial, one column of sections with a contents list.
 * Every sentence describes what the code does today; change the copy when the code changes.
 */
export function PrivacyPage({ locale }: { locale: Locale }) {
  const { m, f, intl } = getI18n(locale);
  const p = m.privacy;
  const updated = new Intl.DateTimeFormat(intl, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${PRIVACY_UPDATED}T00:00:00Z`),
  );
  const sections = [
    { id: "kisaca", title: p.summary.title },
    { id: "plan", title: p.plan.title },
    { id: "olcum", title: p.measurement.title },
    { id: "tarayici", title: p.storage.title },
    { id: "silme", title: p.clear.title },
    { id: "yapay-zeka", title: p.ai.title },
    { id: "kim-ne-gorur", title: p.parties.title },
    { id: "iletisim", title: p.contact.title },
  ] as const;
  const title = (id: (typeof sections)[number]["id"]) => sections.find((s) => s.id === id)!.title;

  return (
    <article aria-labelledby="privacy-title" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-14 md:px-8 md:pt-24">
      <header className="max-w-3xl">
        <Caption as="p">{p.caption}</Caption>
        <h1 id="privacy-title" className="mt-4 font-display text-headline text-ink">
          {p.heading}
        </h1>
        <p className="mt-5 max-w-xl text-body text-ink-muted">{p.lead}</p>
        <Caption as="p" className="mt-6">
          <time dateTime={PRIVACY_UPDATED}>{f(p.updated, { date: updated })}</time>
        </Caption>
      </header>

      <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-12 md:gap-8">
        <nav aria-labelledby="privacy-contents" className="md:col-span-3">
          <div className="md:sticky md:top-24">
            <Caption as="h2" id="privacy-contents">
              {p.contents}
            </Caption>
            <ol className="mt-3 grid gap-1 text-caption">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={`touch-target inline-block py-0.5 ${LINK}`}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="grid gap-12 md:col-span-9 md:gap-14">
          <Section id="kisaca" title={title("kisaca")}>
            <Bullets items={p.summary.items} />
          </Section>

          <Section id="plan" title={title("plan")}>
            <Paragraphs items={p.plan.paragraphs} />
          </Section>

          <Section id="olcum" title={title("olcum")}>
            <Paragraphs items={p.measurement.paragraphs} />
          </Section>

          <Section id="tarayici" title={title("tarayici")}>
            <p className={PROSE}>{p.storage.lead}</p>
            {PRIVACY_STORAGE.map((group) => (
              <div key={group.group} className="mt-2">
                {/* Not an uppercase caption: Turkish uppercase would print "SERVİCE WORKER". */}
                <h3 className="font-mono text-caption text-ink-muted">{p.storage[group.group]}</h3>
                <dl className="mt-3 grid max-w-prose gap-3">
                  {group.entries.map((entry) => (
                    <div key={entry.text} className="grid gap-0.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
                      <dt>
                        <code className="break-all font-mono text-caption text-ink">{entry.key}</code>
                      </dt>
                      <dd className="text-body text-ink-muted">{p.storage[entry.text]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <p className={`mt-2 ${PROSE}`}>{p.storage.language}</p>
          </Section>

          <Section id="silme" title={title("silme")}>
            <p className={PROSE}>{p.clear.lead}</p>
            <Bullets items={p.clear.items} />
          </Section>

          <Section id="yapay-zeka" title={title("yapay-zeka")}>
            <Paragraphs items={p.ai.paragraphs} />
          </Section>

          <Section id="kim-ne-gorur" title={title("kim-ne-gorur")}>
            <p className={PROSE}>{p.parties.lead}</p>
            <dl className="grid max-w-prose gap-5">
              {PARTIES.map((party) => (
                <div key={party.text} className="grid gap-1">
                  <dt className="text-body font-medium text-ink">{party.names.join(" · ")}</dt>
                  <dd className="text-body text-ink-muted">{p.parties[party.text]}</dd>
                </div>
              ))}
            </dl>
            <p className={PROSE}>{p.parties.data}</p>
          </Section>

          <Section id="iletisim" title={title("iletisim")}>
            <p className={PROSE}>{p.contact.body}</p>
            <p className="text-body">
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className={LINK}>
                {p.contact.link}
              </a>
            </p>
            <p className="max-w-prose text-body text-ink-muted">{p.contact.changes}</p>
          </Section>
        </div>
      </div>
    </article>
  );
}
