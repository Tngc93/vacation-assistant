import { Plane } from "lucide-react";
import { Button, Caption, Ticket } from "@/components/ui";
import { formatDay } from "@/lib/format";

// Static preview only: the working search arrives in feat/search (PLAN.md step 2).
const PREVIEW = {
  origin: { codes: "IST · SAW", city: "İstanbul" },
  destination: { code: "BCN", city: "Barselona, İspanya" },
  departure: new Date(Date.UTC(2026, 10, 14, 9)),
  return: new Date(Date.UTC(2026, 10, 18, 9)),
  passengers: 2,
};

export function BoardingPassHero() {
  return (
    <section aria-labelledby="hero-title" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-20">
      <Caption as="p">Türkiye çıkışlı tatil planlayıcısı</Caption>
      <h1 id="hero-title" className="mt-4 max-w-3xl font-display text-display text-ink">
        Nereye uçuyoruz?
      </h1>
      <p className="mt-5 max-w-xl text-body text-ink-muted">
        En ucuz uçuş, vize durumu, TL bütçe ve gün gün şehir planı. Hepsi tek bir biletin üzerinde.
      </p>

      <Ticket raised className="mt-10 md:mt-14" stub={<HeroStub />} aria-label="Biniş kartı önizlemesi">
        <div className="flex items-center justify-between gap-4">
          <Caption>Biniş kartı</Caption>
          <Caption tone="accent">Önizleme</Caption>
        </div>

        <div className="mt-6 flex items-end justify-between gap-3 md:mt-8 md:gap-6">
          <div className="min-w-0">
            <Caption as="p">Nereden</Caption>
            <p className="mt-1 font-mono text-headline font-medium tabular tracking-tight text-ink">
              {PREVIEW.origin.codes}
            </p>
            <p className="mt-1 text-caption text-ink-muted">{PREVIEW.origin.city}</p>
          </div>

          <div aria-hidden="true" className="mb-9 hidden flex-1 items-center gap-2 text-ink-muted sm:flex">
            <span className="h-px flex-1 border-t border-dashed border-rule" />
            <Plane size={18} strokeWidth={1.5} />
            <span className="h-px flex-1 border-t border-dashed border-rule" />
          </div>

          <div className="min-w-0 text-right">
            <Caption as="p">Nereye</Caption>
            <p className="mt-1 font-mono text-headline font-medium tabular tracking-tight text-ink">
              {PREVIEW.destination.code}
            </p>
            <p className="mt-1 text-caption text-ink-muted">{PREVIEW.destination.city}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-rule pt-5 md:mt-8">
          <TicketField label="Gidiş" value={formatDay(PREVIEW.departure)} />
          <TicketField label="Dönüş" value={formatDay(PREVIEW.return)} />
          <TicketField label="Yolcu" value={`${PREVIEW.passengers} kişi`} />
        </dl>
      </Ticket>
    </section>
  );
}

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Caption as="dt">{label}</Caption>
      <dd className="mt-1 truncate font-mono text-caption tabular text-ink sm:text-body">{value}</dd>
    </div>
  );
}

function HeroStub() {
  return (
    <div className="flex h-full flex-col justify-between gap-5">
      <div>
        <Caption as="p">Sefer</Caption>
        <p className="mt-1 font-mono text-heading tabular text-ink">VA · 001</p>
      </div>
      <div
        aria-hidden="true"
        className="h-10 w-full bg-[repeating-linear-gradient(90deg,var(--ink)_0_2px,transparent_2px_4px,var(--ink)_4px_5px,transparent_5px_9px)] opacity-80"
      />
      <div>
        <Button size="lg" className="w-full" aria-describedby="hero-stub-note">
          Planı çıkar
        </Button>
        <Caption as="p" id="hero-stub-note" className="mt-2 block text-center">
          Arama yakında açılacak
        </Caption>
      </div>
    </div>
  );
}
