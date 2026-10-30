import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button, Caption, SkeletonTicket, Stamp, Ticket, type CaptionTone } from "@/components/ui";
import { formatTRY } from "@/lib/format";
import { ChipDemo } from "./ChipDemo";

export const metadata: Metadata = {
  title: "Stil rehberi",
  robots: { index: false },
};

const COLORS: ReadonlyArray<{ token: string; swatch: string; use: string }> = [
  { token: "--paper", swatch: "bg-paper", use: "Sayfa zemini" },
  { token: "--paper-raised", swatch: "bg-paper-raised", use: "Kart ve biletler" },
  { token: "--ink", swatch: "bg-ink", use: "Metin, ana çizgiler" },
  { token: "--ink-muted", swatch: "bg-ink-muted", use: "İkincil metin" },
  { token: "--rule", swatch: "bg-rule", use: "İnce çizgiler, iskelet" },
  { token: "--accent", swatch: "bg-accent", use: "Ana eylem, seçim, en ucuz" },
  { token: "--accent-ink", swatch: "bg-accent-ink", use: "Accent üstündeki metin" },
  { token: "--sea", swatch: "bg-sea", use: "Harita suyu, bilgi, link" },
  { token: "--ok", swatch: "bg-ok", use: "Vizesiz, başarı" },
  { token: "--warn", swatch: "bg-warn", use: "Vize gerekli, uyarı" },
];

const TYPE_SCALE: ReadonlyArray<{ name: string; spec: string; className: string; sample: string }> = [
  { name: "Display", spec: "72 / 44 · Fraunces", className: "font-display text-display", sample: "Lizbon" },
  { name: "Headline", spec: "48 / 32 · Fraunces", className: "font-display text-headline", sample: "Barselona'da üç gün" },
  { name: "Title", spec: "32 · Fraunces", className: "font-display text-title", sample: "Gün gün plan" },
  { name: "Heading", spec: "22 · Geist", className: "text-heading font-medium", sample: "Uçuşlar ve konaklama" },
  {
    name: "Body",
    spec: "16 / 1.5 · Geist",
    className: "text-body",
    sample: "Şehir rehberi OpenStreetMap verisinden gelir; her mekânın kaynağı kartın altında yazar.",
  },
  {
    name: "Small",
    spec: "13 · Geist",
    className: "text-caption text-ink-muted",
    sample: "Fiyatlar son 48 saatteki aramalara dayalı tahmindir.",
  },
  {
    name: "Data",
    spec: "16 · Geist Mono · tabular",
    className: "font-mono text-body tabular",
    sample: `IST 08:45 → BCN 11:20 · ${formatTRY(12450)}`,
  },
];

const CAPTION_TONES: ReadonlyArray<{ tone: CaptionTone; label: string }> = [
  { tone: "muted", label: "Kaynak · OpenStreetMap" },
  { tone: "ink", label: "Önbellekten" },
  { tone: "accent", label: "En ucuz" },
  { tone: "sea", label: "Bilgi" },
  { tone: "ok", label: "Vizesiz" },
  { tone: "warn", label: "Tahmini" },
];

export default function StyleguidePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-20">
      <Caption as="p">Tasarım sistemi · Travel journal</Caption>
      <h1 className="mt-4 font-display text-display">Stil rehberi</h1>
      <p className="mt-5 max-w-xl text-body text-ink-muted">
        Token&apos;lar, tipografi ölçeği ve temel bileşenler. Buradaki örnek veriler yalnızca görünümü göstermek içindir.
      </p>

      <Section title="Renkler" note="Ham hex yok: bileşenler yalnızca bu token'ları kullanır.">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {COLORS.map(({ token, swatch, use }) => (
            <li key={token} className="overflow-hidden rounded-md border border-rule bg-paper-raised">
              <div className={`h-16 border-b border-rule ${swatch}`} />
              <div className="p-3">
                <p className="font-mono text-caption text-ink">{token}</p>
                <p className="mt-1 text-caption text-ink-muted">{use}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tipografi" note="Masaüstü 72 / 48 / 32 / 22 / 16 / 13; mobilde ilk iki adım 44 / 32.">
        <ul className="divide-y divide-rule border-y border-rule">
          {TYPE_SCALE.map(({ name, spec, className, sample }) => (
            <li key={name} className="grid gap-2 py-6 md:grid-cols-[12rem_1fr] md:items-baseline md:gap-8">
              <div>
                <p className="text-caption font-medium text-ink">{name}</p>
                <Caption as="p" lang="en">
                  {spec}
                </Caption>
              </div>
              <p className={`${className} min-w-0 break-words text-ink`}>{sample}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Butonlar" note="Accent yalnızca ana eylem içindir.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Planı çıkar</Button>
          <Button variant="secondary">Güncel fiyatı gör</Button>
          <Button variant="ghost">Vazgeç</Button>
          <Button size="lg">Büyük buton</Button>
          <Button disabled>Devre dışı</Button>
        </div>
      </Section>

      <Section title="Caption" note="Kaynak ve tahmin etiketleri: mono, büyük harf, küçük.">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {CAPTION_TONES.map(({ tone, label }) => (
            <Caption key={tone} tone={tone}>
              {label}
            </Caption>
          ))}
        </div>
      </Section>

      <Section title="Kategori çipleri" note="Seçili çip mürekkep dolgulu, accent değil. Tıklayarak dene.">
        <ChipDemo />
      </Section>

      <Section title="Bilet" note="Delikli ayraç: kesik çizgi ve kenarlarda iki yarım daire çentik. Mobilde koçan alta iner.">
        <div className="grid gap-6">
          <Ticket
            raised
            stubBeside="sm"
            stub={
              <div className="flex h-full flex-col justify-between gap-3">
                <div>
                  <Caption tone="accent" as="p">
                    En ucuz
                  </Caption>
                  <p className="mt-1 font-mono text-title tabular text-accent">{formatTRY(4280)}</p>
                </div>
                <Caption as="p">Önbellekten · tahmini</Caption>
              </div>
            }
          >
            <SampleFlight from="SAW" to="BCN" depart="06:10" arrive="08:55" detail="Aktarmasız · 3 sa 45 dk" />
          </Ticket>
          <Ticket
            stubBeside="sm"
            stub={
              <div className="flex h-full flex-col justify-between gap-3">
                <p className="font-mono text-title tabular text-ink">{formatTRY(5915)}</p>
                <Caption as="p">Önbellekten · tahmini</Caption>
              </div>
            }
          >
            <SampleFlight from="IST" to="BCN" depart="13:40" arrive="18:05" detail="1 aktarma · 5 sa 25 dk" />
          </Ticket>
        </div>
      </Section>

      <Section
        title="Vize damgası"
        note="Vizesiz --ok · varışta vize, e-vize, ETA --sea · vize gerekli, giriş yok --warn · bilinmiyor --ink-muted. 0° hâlinde de net okunur."
      >
        <div className="flex flex-wrap items-center gap-8 md:gap-10">
          <Stamp label="Vizesiz" detail="90 gün" tone="ok" />
          <Stamp label="Varışta vize" tone="sea" />
          <Stamp label="E-vize" tone="sea" />
          <Stamp label="ETA" detail="Elektronik izin" tone="sea" />
          <Stamp label="Vize gerekli" tone="warn" />
          <Stamp label="Giriş yok" tone="warn" />
          <Stamp label="Bilinmiyor" tone="muted" />
          <Stamp label="Vizesiz" detail="90 gün" tone="ok" tilted={false} />
        </div>
      </Section>

      <Section title="İskelet" note="Yükleme hâli: --rule renginde bilet iskeletleri, ortada dönen ikon yok.">
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonTicket label="Yükleniyor" />
          <SkeletonTicket label="Yükleniyor" />
        </div>
      </Section>

      <Section title="Odak" note="Klavye ile gezin: 2px accent halka, 2px boşluk.">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Tab ile odaklan</Button>
          <a href="#icerik" className="text-sea underline">
            Bir link
          </a>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="mt-16 md:mt-24">
      <div className="mb-6 flex flex-col gap-1 border-b border-rule pb-3 md:flex-row md:items-baseline md:justify-between">
        <h2 className="font-display text-title">{title}</h2>
        <p className="text-caption text-ink-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

function SampleFlight({
  from,
  to,
  depart,
  arrive,
  detail,
}: {
  from: string;
  to: string;
  depart: string;
  arrive: string;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-title tabular">{from}</p>
          <p className="font-mono text-caption tabular text-ink-muted">{depart}</p>
        </div>
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-rule" />
        <div className="text-right">
          <p className="font-mono text-title tabular">{to}</p>
          <p className="font-mono text-caption tabular text-ink-muted">{arrive}</p>
        </div>
      </div>
      <Caption as="p" className="mt-4">
        {detail} · Örnek veri
      </Caption>
    </div>
  );
}
