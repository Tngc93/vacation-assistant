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
| Uçuş fiyatları | [Travelpayouts](https://www.travelpayouts.com) — [Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163) (`v3/prices_for_dates`) | Partner programı; token yalnızca sunucuda (`TRAVELPAYOUTS_TOKEN`). **Fiyatlar önbellekten, tahminidir:** Aviasales kullanıcılarının son 48 saatteki aramalarında bulunmuş, bir yetişkin için gidiş-dönüş fiyatlarıdır; satın alma anındaki fiyat farklı olabilir. Her bilette "ÖNBELLEKTEN · … · TAHMİNİ" yazar ve "Güncel fiyatı gör" Aviasales'te aynı aramayı Travelpayouts partner linkiyle (`tp.media`, marker + proje kimliği) açar. Google Flights'a yalnızca link verilir. |
| Konaklama | [Booking](https://www.booking.com) ve [Google Hotels](https://www.google.com/travel/hotels) | Yalnızca link (API yok): şehir, giriş-çıkış tarihi ve kişi sayısı dolu arama. Google Hotels kişi sayısını linkten almıyor. Uygulama otel fiyatı göstermez; ücretsiz bir otel fiyat kaynağı yok. |
| Bütçe | Uçuş: Travelpayouts önbelleği · konaklama ve günlük harcama: **kullanıcının girdiği değer** · kur: yukarıdaki kur zinciri | Konaklama ve günlük harcama için hazır ya da "ortalama" değer yoktur; girilmeyen satır toplama eklenmez ve toplam "KISMİ TOPLAM" olarak işaretlenir. Değerler URL'de durur (`&flight=…&stay=…&daily=…&cur=…`), paylaşılan link aynı bütçeyi açar. |
| Gün gün plan | Önceden çekilmiş mekân verisi (OpenStreetMap, Vikipedi dil sayısı) ve bütçedeki uçuş | Yapay zekâ bağlı değilse tamamen deterministik: aynı girdi her zaman aynı planı verir. Gündüz 18:00'e kadar zamana göre dolar (en fazla 6 durak), akşam mekânı 19:30'da; akşama 90 dakikadan uzun boşluk "SERBEST ZAMAN" olarak görünür, uydurma durakla doldurulmaz. Ziyaret süreleri, yürüme tahmini (kuş uçuşu × 1,3 ÷ 4,5 km/s) ve gün saatleri `src/lib/itinerary/config.ts`'te; hepsi "tahmini" etiketli. Açılış saati bilinmeyen durakta "SAATLERİ DOĞRULA" yazar. Çıkarılan duraklar URL'de (`&skip=…`); plan `.ics` olarak indirilebilir (istemcide üretilir). |
| Yapay zekâ (isteğe bağlı) | Kullanıcının kendi anahtarıyla [Anthropic](https://platform.claude.com/settings/keys), [OpenAI](https://platform.openai.com/api-keys) ya da [Google Gemini](https://aistudio.google.com/app/apikey) (ücretsiz katmanı var) | Anahtar yalnızca tarayıcıda durur (varsayılan sekme oturumu, "Bu cihazda hatırla" ile cihaz); çağrılar tarayıcıdan doğrudan sağlayıcıya gider, sunucumuza hiç uğramaz; kullanım kullanıcının hesabından ücretlendirilir. Model yalnızca çekilmiş mekân listesinden kimlikle seçer; cevap zod ile doğrulanır, liste dışı kimlikte bir kez daha sorulur, yine olmazsa deterministik plan kalır. Saat, açılış ve yürüme kurallarını uygulama hesaplar. Sohbet düzenlemeleri yapılandırılmış komutlardır (`&ai=…&edit=…` URL'de; anahtar asla URL'de değil). |
| Şehirler ve koordinatlar | [Wikidata](https://www.wikidata.org) | CC0. |
| Mekânlar (görülecek yer, müze, restoran, bar…) | [OpenStreetMap](https://www.openstreetmap.org/copyright), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) üzerinden | **ODbL 1.0.** `src/data/places/` OSM'den türetilmiş bir veritabanıdır ([lisans notu](src/data/places/README.md)); "© OpenStreetMap katkıcıları" atfı listede ve haritada. Veri `npm run data:places` ile önceden çekilir ve ayda bir tazelenir; uygulama çalışırken Overpass'a istek atmaz. |
| "Vikipedi'de N dilde" sıralaması | [Wikidata](https://www.wikidata.org) sitelinks (`wbgetentities`, 50'şerlik toplu istek) | CC0; tanımlayıcı User-Agent ile. |
| Önemli yerler ve türleri | [Wikidata Query Service](https://query.wikidata.org) (şehir başına birkaç küçük SPARQL sorgusu, yalnızca veri script'inde) | CC0; tanımlayıcı User-Agent ile, istekler sırayla ve geri çekilmeyle. |
| Şehir fotoğrafı | [Wikimedia Commons](https://commons.wikimedia.org) (Wikidata P18) | Yalnızca CC0, kamu malı, CC BY ve CC BY-SA. Fotoğrafçı, lisans linki ve "renkleri düzenlendi" notu her fotoğrafın altında. Meta veri önceden çekilir; görsel Commons CDN'inden gelir. |
| Harita karoları | [OpenFreeMap](https://openfreemap.org) (OpenMapTiles şeması), [MapLibre GL JS](https://maplibre.org) ile | Ücretsiz, anahtarsız; "© OpenStreetMap katkıcıları · OpenFreeMap" atfı haritada. |

Her fiyat, kur ve vize bilgisi kaynağıyla ve tarihiyle gösterilir; bir kaynak cevap vermezse uygulama bunu açıkça söyler, tahmini ya da sabit değer uydurmaz.

## Geliştirici notları

- Node 22 (`.nvmrc`). Komutlar için [AGENTS.md](AGENTS.md).
- Mekân verisi `src/data/places/` altında commit'lenir; elle tazelemek için `npm run data:places` (tüm şehirler, sırayla; yaklaşık üç saat; yarıda kalırsa aynı komut son 24 saatte çekilenleri atlayıp kaldığı yerden sürer, `-- --force` hepsini yeniden çeker) ya da `npm run data:places -- BCN SJJ`. Görülecek yer kuralları okurken uygulanır (`src/lib/places/rules.ts`, istisnalar `src/data/place-overrides.ts`); kural değiştirmek yeniden çekme gerektirmez. Tür etiketlerini ve `relink` istisnalarını yalnızca Wikidata'dan tazelemek için `npm run data:kinds` (birkaç dakika); bağlantı denetimi `npm run verify:place-links`.
- **Aylık tazeleme** (`.github/workflows/refresh-places.yml`) değişiklik varsa yeni bir branch'e commit atıp "chore: refresh place data" PR'ı açar. Bunun çalışması için repo ayarlarında **Settings → Actions → General → Workflow permissions** altında **"Allow GitHub Actions to create and approve pull requests"** seçeneği açık olmalı.
- **Uçuşlar:** `.env.example`'ı `.env.local` olarak kopyalayıp `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER` ve `TRAVELPAYOUTS_PROJECT_ID`'yi doldur (Vercel'de ortam değişkeni olarak). Partner link biçimini `npm run verify:partner-links` Travelpayouts'un partner link API'siyle karşılaştırır (ağ ister). Token yoksa uçuş bölümü kart yerine Aviasales ve Google Flights linklerini gösterir. Token olmadan arayüzü görmek için `VA_FLIGHTS_FIXTURES=1` örnek veriyi açar; sayfa bunu "ÖRNEK VERİ · GERÇEK FİYAT DEĞİL" bandıyla belirtir ve bu mod Vercel'de çalışmaz.
- `GITHUB_TOKEN` ile açılan PR'lar başka workflow'ları tetiklemez; tazeleme PR'ında CI'ı merge'den önce elle çalıştır (testler tazeleme workflow'unun içinde zaten koşar).

## Lisans

Kod: [MIT](LICENSE). `src/data/places/` altındaki OSM türevi veri: [ODbL 1.0](src/data/places/README.md).
