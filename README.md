# Vacation Assistant

Türkiye'den yola çıkanlar için tatil asistanı: en ucuz uçuş, vize durumu, TL bütçe ve gün gün şehir planı tek ekranda.

> 🚧 Yapım aşamasında. Henüz kullanıma hazır değil.

## Belgeler

- [Ürün gereksinimleri (PRD)](docs/PRD.md)
- [Tasarım dili (DESIGN)](docs/DESIGN.md)
- [Yapım planı (PLAN)](docs/PLAN.md)
- [Ajan çalışma kuralları (AGENTS)](AGENTS.md)

## Veri kaynakları ve atıflar

| Veri | Kaynak | Lisans / şart |
| --- | --- | --- |
| Türk pasaportu (umuma mahsus) vize durumu | [Passport Index Data](https://github.com/imorte/passport-index-data) (Şubat 2026 sonrası), önceki sürümü [ilyankou/passport-index-dataset](https://github.com/ilyankou/passport-index-dataset); veri [passportindex.org](https://www.passportindex.org) kaynaklı | MIT. `src/data/visa-tr.json` kaynak commit'ini ve tarihini taşır; `npm run data:visa` ile güncellenir. |
| Resmî vize bilgisi (link) | [T.C. Dışişleri Bakanlığı — Türk Vatandaşlarının Tabi Olduğu Vize Uygulamaları](https://www.mfa.gov.tr/turk-vatandaslarinin-tabi-oldugu-vize-uygulamalari.tr.mfa) | Yalnızca link verilir. |
| Döviz kurları | [TCMB günlük kurları](https://www.tcmb.gov.tr/kurlar/today.xml) (döviz satış) | Kaynak olarak "TCMB" gösterilir. |
| Döviz kurları (yedek) | [Frankfurter](https://frankfurter.dev) — Avrupa Merkez Bankası verisi | Ücretsiz, anahtarsız. |
| Döviz kurları (ikinci yedek) | [Rates By Exchange Rate API](https://www.exchangerate-api.com) (open access) | Kur gösterilen sayfada atıf linki zorunlu; uygulama bunu otomatik ekler. Verinin toplu olarak yeniden dağıtılması yasak. |
| Uçuş fiyatları | [Travelpayouts](https://www.travelpayouts.com) — [Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163) (`v3/prices_for_dates`) | Partner programı; token yalnızca sunucuda (`TRAVELPAYOUTS_TOKEN`). **Fiyatlar önbellekten, tahminidir:** Aviasales kullanıcılarının son 48 saatteki aramalarında bulunmuş, bir yetişkin için gidiş-dönüş fiyatlarıdır; satın alma anındaki fiyat farklı olabilir. Her bilette "ÖNBELLEKTEN · … · TAHMİNİ" yazar ve "Güncel fiyatı gör" Aviasales'te aynı aramayı açar. Google Flights'a yalnızca link verilir. |
| Şehirler ve koordinatlar | [Wikidata](https://www.wikidata.org) | CC0. |
| Mekânlar (görülecek yer, müze, restoran, bar…) | [OpenStreetMap](https://www.openstreetmap.org/copyright), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) üzerinden | **ODbL 1.0.** `src/data/places/` OSM'den türetilmiş bir veritabanıdır ([lisans notu](src/data/places/README.md)); "© OpenStreetMap katkıcıları" atfı listede ve haritada. Veri `npm run data:places` ile önceden çekilir ve ayda bir tazelenir; uygulama çalışırken Overpass'a istek atmaz. |
| "Vikipedi'de N dilde" sıralaması | [Wikidata](https://www.wikidata.org) sitelinks (`wbgetentities`, 50'şerlik toplu istek) | CC0; tanımlayıcı User-Agent ile. |
| Şehir fotoğrafı | [Wikimedia Commons](https://commons.wikimedia.org) (Wikidata P18) | Yalnızca CC0, kamu malı, CC BY ve CC BY-SA. Fotoğrafçı, lisans linki ve "renkleri düzenlendi" notu her fotoğrafın altında. Meta veri önceden çekilir; görsel Commons CDN'inden gelir. |
| Harita karoları | [OpenFreeMap](https://openfreemap.org) (OpenMapTiles şeması), [MapLibre GL JS](https://maplibre.org) ile | Ücretsiz, anahtarsız; "© OpenStreetMap katkıcıları · OpenFreeMap" atfı haritada. |

Her fiyat, kur ve vize bilgisi kaynağıyla ve tarihiyle gösterilir; bir kaynak cevap vermezse uygulama bunu açıkça söyler, tahmini ya da sabit değer uydurmaz.

## Geliştirici notları

- Node 22 (`.nvmrc`). Komutlar için [AGENTS.md](AGENTS.md).
- Mekân verisi `src/data/places/` altında commit'lenir; elle tazelemek için `npm run data:places` (tüm şehirler, sırayla; yaklaşık bir saat) ya da `npm run data:places -- BCN SJJ`.
- **Aylık tazeleme** (`.github/workflows/refresh-places.yml`) değişiklik varsa yeni bir branch'e commit atıp "chore: refresh place data" PR'ı açar. Bunun çalışması için repo ayarlarında **Settings → Actions → General → Workflow permissions** altında **"Allow GitHub Actions to create and approve pull requests"** seçeneği açık olmalı.
- **Uçuşlar:** `.env.example`'ı `.env.local` olarak kopyalayıp `TRAVELPAYOUTS_TOKEN` ve `TRAVELPAYOUTS_MARKER`'ı doldur (Vercel'de ortam değişkeni olarak). Token yoksa uçuş bölümü kart yerine Aviasales ve Google Flights linklerini gösterir. Token olmadan arayüzü görmek için `VA_FLIGHTS_FIXTURES=1` örnek veriyi açar; sayfa bunu "ÖRNEK VERİ · GERÇEK FİYAT DEĞİL" bandıyla belirtir ve bu mod Vercel'de çalışmaz.
- `GITHUB_TOKEN` ile açılan PR'lar başka workflow'ları tetiklemez; tazeleme PR'ında CI'ı merge'den önce elle çalıştır (testler tazeleme workflow'unun içinde zaten koşar).

## Lisans

Kod: [MIT](LICENSE). `src/data/places/` altındaki OSM türevi veri: [ODbL 1.0](src/data/places/README.md).
