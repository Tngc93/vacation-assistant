# Yayına alma (Vercel)

Vacationist, Vercel'in ücretsiz **Hobby** planında çalışır. Sunucu tarafında yalnızca Next.js var: veritabanı, kuyruk ya da ücretli servis yok. Mekân verisi repoda JSON olarak durur; uçuş fiyatları Travelpayouts'tan, kurlar TCMB / Frankfurter / open.er-api'den çalışma anında gelir.

## 1. Vercel projesi

1. GitHub'da repoyu (ya da fork'unu) hazırla.
2. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → repoyu seç.
3. Framework olarak **Next.js** otomatik seçilir. Build komutu (`npm run build`), çıktı klasörü ve kurulum komutu varsayılan kalır.
4. **Settings → General → Node.js Version:** `22.x` (`package.json`'daki `engines` ve `.nvmrc` ile aynı).
5. Ortam değişkenlerini ekle (aşağıda), sonra **Deploy**.

`main`'e her merge üretime, her PR bir önizleme (preview) adresine gider.

**Canlı adres:** <https://vacationist-app.vercel.app>. Eski adres `vacation-assistant-nine.vercel.app` bu adrese yönlenir (2026-10-23'ten beri); repoda başka yerde geçmez.

> Görseller Wikimedia Commons'ın kendi küçük resimlerinden gelir; Vercel Image Optimization kullanılmaz (`unoptimized` ve düz `<img>`), bu yüzden görsel dönüştürme kotası harcanmaz.

## 2. Ortam değişkenleri

Değerler yalnızca Vercel'de (**Settings → Environment Variables**) ve yerelde `.env.local`'de durur; repoya asla girmez. `.env.example`'da yalnızca adlar var.

| Değişken | Nerede | Ne için |
| --- | --- | --- |
| `TRAVELPAYOUTS_TOKEN` | Production, Preview | Aviasales Data API token'ı. Yalnızca sunucuda okunur (`src/lib/flights/client.ts`, `server-only`), `X-Access-Token` başlığıyla gider. Yoksa uçuş bölümü bilet kartları yerine Aviasales ve Google Flights linklerini gösterir. |
| `TRAVELPAYOUTS_MARKER` | Production, Preview | Partner kimliği (sayısal "marker"); Aviasales linklerine eklenir. |
| `TRAVELPAYOUTS_PROJECT_ID` | Production, Preview | Travelpayouts proje kimliği ("trs"); marker ile birlikte linkler `tp.media` partner linkinden geçer. |

Vercel'in kendi sistem değişkenleri ayrıca tanımlanmaz. Open Graph görsellerinin, `robots.txt` ve `sitemap.xml`'in mutlak adresi `src/lib/brand.ts`'teki `SITE_URL` sabitidir (`metadataBase` de oradan); ortam değişkeninden okunmaz, çünkü birden fazla production alan adı varken Vercel'in `VERCEL_PROJECT_PRODUCTION_URL`'i eskisini verebilir. Fork'u başka adreste yayınlayan bu sabiti değiştirir.

**Vercel'de tanımlanmaz:** `VA_FLIGHTS_FIXTURES`, `VA_AI_MOCK`, `VA_OFFLINE` ve `VA_TEST_NOW` yalnızca yerel geliştirme ve testler içindir; ilk ikisi Vercel'de zaten çalışmaz.

Kullanıcının yapay zekâ anahtarı bir ortam değişkeni değildir: tarayıcıda kalır, sunucuya hiç gelmez.

## 3. Travelpayouts hesabı ve marker

1. [travelpayouts.com](https://www.travelpayouts.com) üzerinden ücretsiz hesap aç.
2. **Programs** altında **Aviasales** programına katıl.
3. **Profile → API token**: token'ı `TRAVELPAYOUTS_TOKEN` olarak kaydet.
4. Partner kimliğin (marker) profilde yazar: `TRAVELPAYOUTS_MARKER`.
5. Bir proje (site) ekle; proje kimliği (`trs`) `TRAVELPAYOUTS_PROJECT_ID` olur.
6. Yerelde `.env.local`'i doldurup partner link biçimini doğrula (ağ ister, değerleri yazdırmaz):

   ```bash
   npm run verify:partner-links
   ```

Fiyatlar Aviasales'in son 48 saatteki aramalarından önbellektir; uygulama her bilette "ÖNBELLEKTEN · TAHMİNİ" yazar. Bilet, otel ya da arama siteleri kazınmaz.

## 4. Aylık mekân verisi yenileme

`src/data/places/` (OpenStreetMap türevi, ODbL) her ayın 1'inde 03:17 UTC'de `.github/workflows/refresh-places.yml` ile tazelenir:

1. Workflow `npm run data:places` çalıştırır (68 şehir, sırayla, ~3 saat), ardından `npm test`.
2. Veri değiştiyse `chore/refresh-places-YYYY-MM-DD` branch'ine commit atıp "chore: refresh place data" PR'ı açar.
3. Bunun için repo ayarlarında **Settings → Actions → General → Workflow permissions** altında **"Allow GitHub Actions to create and approve pull requests"** açık olmalı.
4. `GITHUB_TOKEN` ile açılan PR başka workflow'ları tetiklemez: merge'den önce CI'ı elle çalıştır (Actions → CI → Run workflow) ya da boş bir commit it.
5. PR merge edilince Vercel üretimi yeniden derler; veri çalışma anında Overpass'a ya da Wikidata'ya gitmez.

Elle tazelemek için: `npm run data:places` (yarıda kalırsa aynı komut kaldığı yerden sürer), tek şehir için `npm run data:places -- BCN`. Yalnızca tür etiketleri ve `relink` istisnaları için `npm run data:kinds` (birkaç dakika).

## 5. Vercel Hobby: ticari olmayan kullanım

Vercel Hobby planı **yalnızca kişisel, ticari olmayan kullanım** içindir ([Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)). Vacationist ücretsizdir ve reklam göstermez; ancak Travelpayouts partner linkleri komisyon getirebilir. Proje gelir getirmeye başlarsa ya da ticari bir kuruluş adına yayınlanırsa **Pro** plana geçmek gerekir. Fork'layıp kendi adına yayınlayan herkes bu şartı kendi kullanımı için değerlendirmeli.

## 6. Yayın sonrası kontrol

- Ana sayfa ve bir plan linki açılıyor; uçuş bölümünde "ÖRNEK VERİ" bandı **yok** (o yalnızca yerel `VA_FLIGHTS_FIXTURES=1` içindir).
- `/robots.txt`, `/sitemap.xml` ve `/opengraph-image` 200 dönüyor; bir plan linkini paylaşınca önizlemede şehir adı ve tarihler görünüyor.
- Lighthouse (production build, `npx`, projeye paket eklenmez):

  ```bash
  npx lighthouse@12 https://vacationist-app.vercel.app/ --preset=desktop --view
  ```

  Hedefler: Performance masaüstü ≥90, mobil ≥80; Accessibility ≥95; Best Practices ≥95; SEO ≥90 (`noindex` sayfalar hariç). Son ölçüm aşağıda.

### Son Lighthouse ölçümü

Production build (`next start`, `VA_FLIGHTS_FIXTURES=1`, gerçek Commons görselleri ve kurlar), `npx lighthouse@12`, her satır 3 ölçümün medyanı; "önce" aynı makinede derlenmiş `main` (`66cb70b`), "sonra" `chore/launch`. Plan: `/plan?to=BCN&depart=…&return=…` (30 gün sonrası, 4 gece). 2026-10-23.

| Sayfa | Cihaz | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- | --- | --- |
| Ana sayfa | Mobil | 87 → **90** | 100 → **100** | 100 → **100** | 100 → **100** |
| Ana sayfa | Masaüstü | 100 → **100** | 100 → **100** | 100 → **100** | 100 → **100** |
| Plan | Mobil | 81 → **81** | 93 → **100** | 75 → **96** | 91 → 92* |
| Plan | Masaüstü | 94 → **96** | 93 → **100** | 78 → **100** | 91 → 92* |

\* Plan sayfası `noindex`; SEO hedefinin dışında (puanı `noindex` ve Lighthouse'un akışla gelen meta açıklamayı görmemesi düşürüyor).

Düzeltilenler: bütçe fişinin `<dl>` yapısı ve karusel kartlarının erişilebilir adı (Accessibility); Wikimedia görsellerinin üçüncü taraf çerezleri (`crossorigin="anonymous"`) ve Zod'un `new Function` yoklamasının CSP ihlali (`jitless`) (Best Practices); şehir fotoğrafı srcset + yalnızca masaüstünde ön yükleme, font ön yüklemesi yalnızca latin (Performance).

Kalan: plan sayfası mobil performansı hedefin (80) hemen üstünde. En büyük boyama ilk kartın Commons fotoğrafı; süresini çoğunlukla Commons CDN'inin cevap süresi belirliyor, ölçümler arasında ±1–2 puan oynuyor.
