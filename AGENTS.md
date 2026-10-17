# AGENTS.md — Vacation Assistant

Vacation Assistant, Türkiye'den (İstanbul ya da Ankara) yurt dışına kısa şehir tatili planlayan gezginler için açık kaynak bir web uygulamasıdır. Tek ekranda en ucuz uçuşu (IST / SAW / ESB), Türk pasaportu için vize durumunu, TL cinsinden toplam bütçeyi ve gün gün şehir planını gösterir. Uygulama yapay zekâ olmadan tam çalışır; kullanıcı isterse kendi yapay zekâ anahtarını tarayıcıda bağlayıp planı sohbetle değiştirebilir. Tamamen ücretsiz servislerle çalışır ve Vercel'de yayınlanır.

## Kaynak belgeler

- [docs/PRD.md](docs/PRD.md) — ürün gereksinimleri (madde numaraları PLAN.md'de referans verilir)
- [docs/DESIGN.md](docs/DESIGN.md) — "Travel journal" görsel dili, token'lar, tipografi, imza bileşenler
- [docs/PLAN.md](docs/PLAN.md) — adım adım yapım planı (bir adım = bir branch = bir PR)

## Komutlar

Node 22 gerekir (`.nvmrc`). Önce `npm ci`.

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (http://localhost:3000, Turbopack) |
| `npm run build` | Üretim derlemesi |
| `npm start` | Derlenmiş uygulamayı çalıştırır |
| `npm run lint` | ESLint (uyarı da hata sayılır) |
| `npm run typecheck` | Next.js route tiplerini üretir, ardından `tsc --noEmit` (strict) |
| `npm test` | Vitest + Testing Library, tek seferlik (izleme modu: `npm run test:watch`). `TZ=Asia/Tokyo` ve `VA_TEST_NOW=2026-10-18T00:01:00+03:00` ile başka saat diliminde ve sabit saatte çalıştırılabilir |
| `npm run check:bundle` | Build sonrası: sunucuya özel verinin (mekân dosyaları) ve Travelpayouts token'ının, başlığının ve API adresinin istemci paketine sızmadığını kontrol eder (CI build'i sahte bir token'la yapar) |
| `npm run test:e2e` | Playwright: üretim build'ine karşı uçtan uca testler (önce `npm run build`; ilk seferde `npx playwright install chromium`) |
| `npm run data:places` | 68 şehir için mekân verisini (OSM/Overpass, Wikidata, Commons) sırayla çekip `src/data/places/<KOD>.json`'a yazar (ağ ister; ~1 saat). Uygulama bu dosyaları yalnızca sunucuda okur |
| `npm run data:visa` | Vize verisini indirir, yalnızca TR pasaportunu `src/data/visa-tr.json`'a yazar (ağ ister; JSON commit'lenir, build ve CI vize verisi için internete çıkmaz) |
| `npm run verify:partner-links` | Yerelde kurulan Aviasales partner linklerini (`tp.media`, marker + trs) Travelpayouts'un `links/v1/create` API'sinin döndürdüğüyle karşılaştırır (ağ ve `.env.local` ister, CI'da çalışmaz, değerleri yazdırmaz) |
| `npm run verify:destinations` | `src/data/destinations.ts`'i Wikidata'ya karşı yeniden doğrular (ağ ister, CI'da çalışmaz) |

CI (`.github/workflows/ci.yml`) her push ve PR'da iki iş çalıştırır: birim testleri beş saat dilimi/saat birleşiminde (UTC, Asia/Tokyo; Los Angeles, Tokyo ve İstanbul'da sabit İstanbul saati 23:59, 00:01, 03:20) ve `npm ci`, lint, typecheck, build, `check:bundle`, e2e. Playwright tarayıcısı önbelleğe alınır.

## Kod düzeni

- `src/app/globals.css` — tüm renk token'ları (light + dark), Tailwind teması, grain dokusu. Ham renk değeri yalnızca burada durur; `src/test/design-tokens.test.ts` bunu ve WCAG AA kontrastını denetler.
- `src/app/fonts.ts` — Fraunces, Geist, Geist Mono (`next/font/google`).
- `src/components/ui/` — temel bileşenler: Button, Caption, Chip, Skeleton, Stamp, Ticket.
- `src/lib/format.ts` — `tr-TR` biçimlendirme (`12.450 ₺`, `14 Kas Cmt`, 24 saat).
- `src/data/` — kalkış şehirleri (`origins.ts`) ve ~65 varış şehri (`destinations.ts`; QID ve koordinatlar Wikidata'dan).
- `src/lib/search/` — arama durumu: URL ayrıştırma ve doğrulama yalnızca `params.ts`'te (zod); tarih kuralları `dates.ts`; Türkçe arama `normalize.ts`.
- `src/lib/visa/` — vize: CSV → JSON dönüşümü, gereklilik türleri, damga metinleri. `src/lib/rates/` — kur: TCMB → Frankfurter → Exchange Rate API, 4 sn zaman aşımı, ~6 saat önbellek, asla uydurma kur yok.
- `src/lib/flights/` — uçuşlar: Travelpayouts `v3/prices_for_dates` (sorgu `params.ts`, zod şeması `schema.ts`, bilet hesapları `tickets.ts`, linkler `links.ts`). Token yalnızca `client.ts`'te (`server-only`) okunur ve `X-Access-Token` başlığıyla gider; IST ve SAW ayrı sorgulanır, cevaplar birleştirilip her bilet kendi kalkış havalimanına göre gruplanır (IST sorgusu SAW biletleri de döndürür), tam tarihte sonuç yoksa ±3 gün yedeği "FARKLI TARİH" etiketiyle. `VA_FLIGHTS_FIXTURES=1` (Vercel dışında) `__fixtures__/` örnek verisini görünür bir "ÖRNEK VERİ" bandıyla açar.
- `src/lib/budget/` — bütçe fişi: para tam sayı kuruş olarak tutulur, kur çevrimi BigInt ile (`money.ts`, kayan nokta toplamı yok); URL durumu `params.ts` (`flight`, `stay`, `daily`, `cur`); satırlar ve kısmi toplam `receipt.ts`. Konaklama ve günlük harcama için hazır/ortalama değer **konmaz**: yalnızca kullanıcının girdiği değer (8. adımda yapay zekâ tahmini eklenecek). `src/lib/stays/` — Booking ve Google Hotels linkleri (API yok). `src/lib/flights/select.ts` — bütçedeki bilet (`?flight=`, yoksa seçilen tarihlerin en ucuzu).
- `src/lib/places/` — şehir rehberi: kategori eşlemesi tek dosyada (`categories.ts`), Overpass sorgusu, sıralama (Vikipedi dil sayısı ya da OSM kaydının ayrıntısı; görülecek yer, müze ve manzarada aynı adlı ve 1 km içindeki OSM nesneleri tek mekân sayılır, `twins.ts`; yeme-içmede aynı ad çoğunlukla zincirin başka şubesi olduğu için birleştirilmez), `?cats=` parametresi; veri önceden çekilmiş JSON'dan (`src/data/places/`, ODbL) sunucuda okunur, çalışma anında Overpass/Wikidata/Commons çağrısı yok. Açılış saatleri `hours.ts` (desteklenmeyen biçim gizlenir). `src/lib/city/` — masthead: Commons fotoğrafı ve lisans filtresi, koordinat ve yerel saat.
- Wikimedia/Wikidata/Overpass istekleri (yalnızca veri script'inde) `VacationAssistant/0.1 (https://github.com/Tngc93/vacation-assistant)` User-Agent'ı ile gider. `VA_OFFLINE=1` (yalnızca e2e sunucusu) tüm dış kaynakları anında başarısız kılar.
- `src/components/search/` — biniş kartı arama formu: kalkış, combobox, tarih aralığı, yolcu.
- `/` arama formu · `/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2` plan sayfası · `/styleguide` bileşen vitrini.

## Çalışma kuralları

- **Branch ve PR:** Her iş PLAN.md'deki gibi kendi branch'inde yapılır (`feat/…`, `fix/…`, `chore/…`). `main`'e doğrudan commit ya da push yok. PR açmadan önce Berk'e sorulur.
- **Tamamen ücretsiz:** Ücretli servis, kredi kartı isteyen API ya da ücretli paket yok. Emin değilsen sor.
- **Kazıma yok:** Uçuş, otel ya da arama sitelerini kazıma (scraping) yok. Veri yalnızca PRD'deki kaynaklardan gelir.
- **Gizli anahtarlar:** Yalnızca `.env.local`'de ve Vercel ortam değişkenlerinde durur. Asla commit'lenmez, asla istemciye gitmez. `.env.example`'da yalnızca değişken adları olur.
- **Kullanıcının yapay zekâ anahtarı:** Yalnızca tarayıcıda tutulur, sunucuya kaydedilmez ve loglanmaz.
- **Dürüst veri:** Her fiyat ve tahmin kaynağını ve "tahmini" etiketini gösterir. Uydurma veri yok. Bir kaynak cevap vermezse bunu açıkça göster.
- **Dil:** Arayüz metinleri Türkçe; kod, yorumlar ve commit mesajları İngilizce.
- **Tasarım:** Görsel kararlar DESIGN.md'ye uyar. Ham hex renk yok, yalnızca token'lar.
- **Zaman:** Zamana bağlı her fonksiyon `now` parametresi alır; istemci bileşenleri zamanı `useMinuteNow()`'dan okur. Testler sabit saatle çalışır (`vi.setSystemTime` / `vi.useFakeTimers`); gerçek saate, makinenin saat dilimine ya da animasyon karesine bağlı test yok. Zaman aşımları `timeoutSignal` ile kurulur ki sahte saatle sınansın.
- **Kalite kapısı:** Bir adımı bitirmeden önce lint, typecheck ve test geçmeli.
