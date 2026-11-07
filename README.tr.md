<p align="right"><a href="README.md">English</a> · <b>Türkçe</b></p>

![Vacationist — Plan short city breaks. Barselona'nın plan sayfası: şehir adı ve tarihler, kategori çipleri, fotoğraflı görülecek yerler karuseli, şehir fotoğrafı ve harita.](docs/screenshots/banner.webp)

# Vacationist

[![CI](https://github.com/Tngc93/vacation-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Tngc93/vacation-assistant/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/license-MIT-16181D)](LICENSE)
[![Canlı site](https://img.shields.io/badge/live-vacationist--app.vercel.app-B8492A)](https://vacationist-app.vercel.app)
[![PWA: kurulur, çevrimdışı açılır](https://img.shields.io/badge/PWA-installable%20%C2%B7%20offline-1F5560)](#ne-yapar)

Kısa şehir tatili için ücretsiz, açık kaynak planlayıcı: şehri ve günleri seç, istediğin şehirden kalk; 68 şehirde görülecek yerler, gün gün plan, en ucuz uçuş ve bütçe (TL, EUR, USD ya da GBP) tek sayfada gelsin, yapay zekâ isteğe bağlı ve kendi anahtarınla.

**Canlı:** <https://vacationist-app.vercel.app> (Türkçe) · <https://vacationist-app.vercel.app/en> (İngilizce)

*Kısa şehir kaçamakları için planlayıcı.* Açık kaynak ve tamamen ücretsiz servislerle çalışır. Repo ve paket adı `vacation-assistant` olarak kalır.

## Demo

![Hareketli demo: ana sayfada "Barc" yazılıp Barselona seçiliyor, 18 ve 22 Aralık seçilirken noktalı haritada İstanbul'dan Barselona'ya kesik bir rota çiziliyor; "Plan" plan sayfasını açıyor (görülecek yer kartları, şehir fotoğrafı, harita), karusel ilerliyor, sonra sayfa gün gün plan, konaklama, uçuşlar ve bütçe boyunca kayıyor. Arayüz İngilizce.](docs/screenshots/demo.webp)

## Nasıl çalışır

| Ana sayfa: nereye ve ne zaman | Plan: görülecek yerler ve harita |
| --- | --- |
| ![Ana sayfa: "Nereye gidiyorsun?", varış şehri, gidiş ve dönüş tarihleri, "Planla" ve Keşfet çipleri; arkada noktalı harita ve kalkış şehrinden çizilen rotalar.](docs/screenshots/tr-home.webp) | ![Barselona'nın plan sayfası: rota şeridi IST–BCN, tarih ve kur satırı, kategori çipleri, Basílica de la Sagrada Família, Güell Parkı ve Casa Batlló kartları, şehir fotoğrafı ve harita.](docs/screenshots/tr-plan.webp) |
| **Gün gün plan (koyu tema)** | **Bütçe** |
| ![Koyu temada gün gün plan: uçuş satırı, 1. gün Park Güell, Casa de les Punxes, serbest zaman ve akşam restoranı; yanda günün haritası. Arayüz İngilizce.](docs/screenshots/step-3-day-by-day-dark.webp) | ![EUR'da bütçe: konaklama ve günlük harcama girilmiş; fişte uçuş (örnek veri), konaklama, günlük harcama ve toplam, kurun kaynağı. Arayüz İngilizce.](docs/screenshots/step-6-budget.webp) |
| **Konaklama** | **Uçuşlar** |
| ![Konaklama: kişi seçici, Booking ve Google Hotels linkleri. Arayüz İngilizce.](docs/screenshots/step-4-stays.webp) | ![Uçuşlar: kalkış İstanbul (IST + SAW), "ÖRNEK VERİ" bandı ve havalimanı başına en ucuz bilet. Arayüz İngilizce.](docs/screenshots/step-5-flights.webp) |
| **Alt duraklar: Moskova Kremlini** | **Yapay zekâ paneli ve sohbetle düzenleme** |
| ![Moskova'da bir gün: Kızıl Meydan, ardından Kremlin ve altında içindeki yerler (Çar Topu, Çar Çanı, katedraller). Arayüz İngilizce.](docs/screenshots/feature-sub-stops.webp) | ![Gün gün plan ve sağda yapay zekâ paneli: OpenAI · gpt-5-mini, sohbet kutusu, son değişiklik ve "Geri al". Yerel sahte sağlayıcı; gerçek anahtar kullanılmadı. Arayüz İngilizce.](docs/screenshots/feature-ai.webp) |

Daha fazla ekran görüntüsü (etkinlikler, kokteyl barları, merkeze uzaklık, kalkış araması) [İngilizce README](README.md#features)'de.

### Telefonda

<p>
  <img src="docs/screenshots/mobile-home.webp" width="250" alt="Telefonda ana sayfa: Where are you going?, alt alta form, tam genişlikte Plan butonu, Keşfet çipleri ve altta noktalı harita.">
  <img src="docs/screenshots/mobile-plan.webp" width="250" alt="Telefonda plan: rota şeridi, Barselona kartı, şehir fotoğrafı, tek satırda çipler ve ilk kart.">
  <img src="docs/screenshots/mobile-pwa-offline.webp" width="250" alt="Kurulu uygulama çevrimdışı: 'You are offline; this plan is shown as you last opened it.' şeridi ve kayıtlı Barselona planı.">
</p>

<sub>Görseller `npm run build && npm run screenshots` ile üretim build'inden Playwright'la alınır: uçuşlar ve kurlar örnek veriyle (`VA_FLIGHTS_FIXTURES=1`, `VA_RATES_FIXTURES=1`; fiyatlar gerçek değildir), yapay zekâ paneli tarayıcı içinde cevaplanan sahte bir OpenAI'yla ve açıkça sahte bir anahtarla (`VA_AI_MOCK=1` açık); gerçek anahtar kullanılmadı. Tarayıcı saati çalıştırıldığı günün 10:00'una (İstanbul) sabitlenir. Masaüstü 1440 px, telefon 375 × 812 (2× piksel); kurulu uygulama `display-mode: standalone` DevTools protokolüyle taklit edilerek, plan bir kez açılıp ağ kapatılarak çekildi. Commons fotoğrafları ve harita karoları canlı yüklenir.</sub>

## Ne yapar

- **Nereye ve ne zaman:** ana sayfa yalnızca varış şehrini ve tarihleri sorar ("Nereye gidiyorsun?"); Avrupa'dan Körfez'e, Kuzey Afrika'dan Uzak Doğu'ya 68 şehir. Kalkış (uçuşa açık havalimanı olan her şehir, varsayılan İstanbul: IST + SAW) ve kişi sayısı plan sayfasında, Konaklama ve Uçuşlar bölümlerinde seçilir; son kalkış tarayıcıda hatırlanır.
- **Görülecek yerler:** OpenStreetMap ve Wikidata'dan önceden çekilmiş mekânlar; Vikipedi'de kaç dilde olduğuna göre "mutlaka gör" sırası, Commons fotoğraflı karusel, harita ve kategoriler (görülecek yer, müze, manzara, restoran, kafe, kokteyl bar, bar ve pub, gece kulübü). Kokteyl barları Wikidata'dan takviye edilir.
- **Okunur adlar:** Latin harfli bir ad varsa o gösterilir ("Tokyo Kulesi · 東京タワー"); yoksa ad ülkenin resmî sistemiyle Latin harflerine çevrilir (Rusça, Sırpça, Bulgarca, Makedonca, Özbekçe, Yunanca, Gürcüce, Korece), yerel ad küçük yazıyla kalır.
- **Merkeze uzaklık:** şehrin turistik merkezinden uzak yerler "MERKEZE ~6 KM" etiketini taşır; 3 km'den uzun yürüyüşte "TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR".
- **Etkinlikler:** gezinin tarihlerinde şehirde büyük, yıllık bir etkinlik (festival, karnaval, Noel pazarı, film ya da müzik festivali) varsa "Etkinlik" çipiyle, tarihiyle ve kaynağıyla (Wikidata) gösterilir; kesin tarihli olanlar şehir başlığında ve gün gün planda not olarak da görünür. Tarih bilinmiyorsa etkinlik gösterilmez.
- **Gün gün plan:** deterministik; uçuş saatlerine, açılış saatlerine ve yürüme mesafesine göre. Bir yerin içindeki yerler (Moskova Kremlini'ndeki Çar Çanı, Vatikan Müzeleri'ndeki Stanze di Raffaello) alt durak olarak onunla gelir; merkeze uzak bir bölge tek güne toplanır. Durak çıkarılabilir, plan `.ics` olarak takvime eklenir ve yazdırılabilir.
- **Konaklama:** Booking ve Google Hotels'te tarihleri ve kişi sayısı dolu arama linkleri (otel fiyatı uydurulmaz).
- **Uçuşlar:** kalkış şehrinin her havalimanından (Londra'da LHR, LGW, STN, LTN, LCY, SEN) en ucuz bilet, altında tam liste ve aktarmasız filtresi (Travelpayouts önbelleği, "tahmini" etiketiyle).
- **Bütçe:** uçuş, konaklama ve günlük harcama seçtiğin para biriminde (TL, EUR, USD, GBP; çapraz kur TL üzerinden), kaynak ve kurla; değerler ve para birimi URL'de, paylaşılan link aynı planı açar.
- **Telefona kur, çevrimdışı aç:** site bir PWA'dır; tarayıcının "Ana Ekrana Ekle" / "Uygulamayı yükle" akışıyla kurulur (footer'da "Uygulamayı telefona ekle"). Açtığın son 10 plan internet olmadan da son açtığın hâliyle açılır; üstte bunu söyleyen bir şerit, uçuşlarda "fiyatlar güncel değil" notu çıkar. API istekleri (uçuş, kur, kalkış araması), Analytics ve yapay zekâ çağrıları asla önbelleğe alınmaz; yapay zekâ anahtarın service worker'a hiç uğramaz.
- **Türkçe ve İngilizce:** Türkçe kökte (`/`, `/plan`), İngilizce `/en` altında (`/en`, `/en/plan`). Başlıktaki TR / EN anahtarı aynı sayfayı bütün parametreleriyle öbür dilde açar; tarayıcı diline göre otomatik yönlendirme yok. İngilizce sayfada yer ve etkinlik adları İngilizce Vikipedi başlığıyla (yoksa Wikidata'nın İngilizce etiketiyle; "Sagrada Família", "Colosseum"), şehir ve havalimanı adları İngilizce, tarih ve sayılar `en-GB` biçiminde, bütçe varsayılan olarak EUR; yapay zekâ cevapları da arayüz dilinde.

### Yapay zekâ olmadan tam çalışır

Plan, sıralama ve bütçe yapay zekâya ihtiyaç duymaz; aynı girdi her zaman aynı planı verir.

### İstersen kendi anahtarınla yapay zekâ (BYOK)

Anthropic, OpenAI ya da Google Gemini anahtarını bağlayıp planı sohbetle değiştirebilirsin ("ikinci günü daha sakin yap", "müzeleri azalt"). Panel gün gün planın yanındaki "Yapay zekâ ile planla" sekmesinden açılır: masaüstünde sağda, günler solda görünür kalır; telefonda alttan tam ekran. Anahtar **yalnızca tarayıcında** kalır (varsayılan sekme oturumu, istersen "Bu cihazda hatırla"); çağrılar tarayıcından doğrudan sağlayıcıya gider, sunucumuza hiç uğramaz, URL'ye yazılmaz, loglanmaz. Model yalnızca çekilmiş mekân listesinden seçer; saat, açılış ve yürüme kurallarını uygulama hesaplar.

**Gemini ücretsiz katman notu:** Gemini'nin ücretsiz katmanı plan sohbeti için yeterli. "Web'de ara" (uçuş fiyatı ve semte göre otel aralığı) ise ücretsiz katmanda yalnızca Gemini 2.5 modellerinde vardı ve Google bu modelleri yeni hesaplara kapattı; Gemini 3'te ücretsiz katmanda Google Search yok (2026-10-21'de kontrol edildi). Anthropic ve OpenAI'da web araması sağlayıcının kendi ücretiyle çalışır.

### Dürüst veri

Her fiyat, kur ve tahmin kaynağıyla ve "tahmini" etiketiyle gösterilir. Bir kaynak cevap vermezse uygulama bunu açıkça söyler; tahmini ya da sabit değer uydurmaz. Konaklama ve günlük harcama için hazır "ortalama" yoktur: yalnızca senin girdiğin değer. Uçuş, otel ya da arama siteleri kazınmaz.

## Mimari

```mermaid
flowchart LR
  subgraph SRC["Açık veri (script'lerle çekilir, çalışırken değil)"]
    OSM["Overpass üzerinden OpenStreetMap (ODbL)"]
    WD["Wikidata ve Query Service (CC0)"]
    CM["Wikimedia Commons: fotoğraf meta verisi"]
    OA["OurAirports (kamu malı)"]
    GN["GeoNames saat dilimleri (CC BY 4.0)"]
    NE["Natural Earth (kamu malı)"]
  end
  SRC --> DATA["npm run data:* ve aylık tazeleme: src/data/*.json, commit'li"]
  DATA --> NEXT
  subgraph VERCEL["Vercel'de Next.js"]
    NEXT["Sunucu bileşenleri: mekânlar, plan motoru, etkinlikler, kalkış araması"]
    FLIGHTS["Uçuşlar: Travelpayouts token'ı yalnızca sunucuda"]
    RATES["Kur: TCMB, sonra Frankfurter, sonra Exchange Rate API"]
  end
  TP["Travelpayouts / Aviasales Data API"] --> FLIGHTS
  BANKS["TCMB · Frankfurter · Exchange Rate API"] --> RATES
  NEXT --> BROWSER
  FLIGHTS --> BROWSER
  RATES --> BROWSER
  BROWSER["Tarayıcı: PWA, service worker, MapLibre"]
  TILES["OpenFreeMap karoları · Commons görselleri"] --> BROWSER
  BROWSER -->|"isteğe bağlı: kendi anahtarın, doğrudan sağlayıcıya"| AI["Anthropic · OpenAI · Gemini"]
```

Veri script'lerle önceden çekilir ve yalnızca sunucuda okunur; uygulama çalışırken Overpass, Wikidata ya da Commons API'sine istek atmaz. Uçuş fiyatı ve kur sunucuda alınır; yapay zekâ çağrıları tarayıcıdan doğrudan sağlayıcıya gider, sunucumuza ve service worker'a uğramaz.

## Gizlilik

Gizlilik sayfası: [vacationist-app.vercel.app/gizlilik](https://vacationist-app.vercel.app/gizlilik). Kısaca: ziyaretler Vercel Web Analytics ile çerezsiz sayılır, yalnızca sayfanın yolu gider (URL'deki gezi bilgisi önce atılır), custom event yok; yapay zekâ anahtarın ve sohbetin tarayıcında kalır.

## Veri kaynakları ve lisanslar

| Veri | Kaynak | Lisans / şart |
| --- | --- | --- |
| Türk pasaportu (umuma mahsus) vize durumu (veri kodda; faz 1 arayüzünde gösterilmiyor) | [Passport Index Data](https://github.com/imorte/passport-index-data) (Şubat 2026 sonrası), önceki sürümü [ilyankou/passport-index-dataset](https://github.com/ilyankou/passport-index-dataset); veri [passportindex.org](https://www.passportindex.org) kaynaklı | MIT. `src/data/visa-tr.json` kaynak commit'ini ve tarihini taşır; `npm run data:visa` ile güncellenir. |
| Resmî vize bilgisi (link) | [T.C. Dışişleri Bakanlığı — Türk Vatandaşlarının Tabi Olduğu Vize Uygulamaları](https://www.mfa.gov.tr/turk-vatandaslarinin-tabi-oldugu-vize-uygulamalari.tr.mfa) | Yalnızca link verilir. |
| Döviz kurları | [TCMB günlük kurları](https://www.tcmb.gov.tr/kurlar/today.xml) (döviz satış) | Kaynak olarak "TCMB" gösterilir. |
| Döviz kurları (yedek) | [Frankfurter](https://frankfurter.dev) — Avrupa Merkez Bankası verisi | Ücretsiz, anahtarsız. |
| Döviz kurları (ikinci yedek) | [Rates By Exchange Rate API](https://www.exchangerate-api.com) (open access) | Kur gösterilen sayfada atıf linki zorunlu; uygulama bunu otomatik ekler. Verinin toplu olarak yeniden dağıtılması yasak. |
| Kalkış şehirleri ve havayolları | [OurAirports](https://ourairports.com/data/) `airports.csv` (tarifeli büyük ve orta havalimanları) · Türkçe adlar ve havayolu adları [Wikidata](https://www.wikidata.org)'dan (havalimanı IATA kodu P238, hizmet verdiği yer P931, havayolu kodu P229) · saat dilimleri [GeoNames](https://www.geonames.org) `cities1000` | OurAirports kamu malı; Wikidata CC0; GeoNames [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (atıf footer'da). Çok havalimanlı şehirler IATA metropol koduyla gruplanır (`src/lib/origins/metros.ts`). `src/data/origins.json` `npm run data:origins`, `src/data/airlines.json` `npm run data:airlines` ile üretilir, ayda bir tazelenir ve yalnızca sunucuda okunur (tarayıcı `/api/origins?q=` ile birkaç satır alır). Travelpayouts'un statik dosyaları yeniden dağıtım izni olmadığı için kullanılmaz. |
| Ana sayfa haritası | [Natural Earth](https://www.naturalearthdata.com) 1:110m kara poligonları (v5.1.2) | Kamu malı. `npm run data:world-dots` yarım derecelik bir kara ızgarası üretir (`src/data/world-dots.json`, ~33 KB, sıkıştırılmış ~4,5 KB); ana sayfanın arka planındaki nokta haritası bundan çizilir. |
| Uçuş fiyatları | [Travelpayouts](https://www.travelpayouts.com) — [Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163) (`v3/prices_for_dates`) | Partner programı; token yalnızca sunucuda (`TRAVELPAYOUTS_TOKEN`). **Fiyatlar önbellekten, tahminidir:** Aviasales kullanıcılarının son 48 saatteki aramalarında bulunmuş, bir yetişkin için gidiş-dönüş fiyatlarıdır; satın alma anındaki fiyat farklı olabilir. Her bilette "ÖNBELLEKTEN · … · TAHMİNİ" yazar ve "Güncel fiyatı gör" Aviasales'te aynı aramayı Travelpayouts partner linkiyle (`tp.media`, marker + proje kimliği) açar. Google Flights'a yalnızca link verilir. |
| Konaklama | [Booking](https://www.booking.com) ve [Google Hotels](https://www.google.com/travel/hotels) | Yalnızca link (API yok): şehir, giriş-çıkış tarihi ve kişi sayısı dolu arama. Google Hotels kişi sayısını linkten almıyor. Uygulama otel fiyatı göstermez; ücretsiz bir otel fiyat kaynağı yok. |
| Bütçe | Uçuş: Travelpayouts önbelleği · konaklama ve günlük harcama: **kullanıcının girdiği değer** · kur: yukarıdaki kur zinciri | Konaklama ve günlük harcama için hazır ya da "ortalama" değer yoktur; girilmeyen satır toplama eklenmez ve toplam "KISMİ TOPLAM" olarak işaretlenir. Değerler URL'de durur (`&flight=…&stay=…&daily=…&cur=…`), paylaşılan link aynı bütçeyi açar. |
| Gün gün plan | Önceden çekilmiş mekân verisi (OpenStreetMap, Wikidata, Vikipedi dil sayısı) ve bütçedeki uçuş | Yapay zekâ bağlı değilse tamamen deterministik: aynı girdi her zaman aynı planı verir. Gündüz 18:00'e kadar zamana göre dolar (en fazla 6 durak; bir yerin içindeki yerler alt durak olarak sayılmaz), akşam mekânı 19:30'da; akşama 90 dakikadan uzun boşluk "SERBEST ZAMAN" olarak görünür, uydurma durakla doldurulmaz. Ziyaret süreleri, yürüme tahmini (kuş uçuşu × 1,3 ÷ 4,5 km/s) ve gün saatleri `src/lib/itinerary/config.ts`'te; hepsi "tahmini" etiketli. Açılış saati bilinmeyen durakta "SAATLERİ DOĞRULA" yazar. Çıkarılan duraklar URL'de (`&skip=…`); plan `.ics` olarak indirilebilir (istemcide üretilir). |
| Yapay zekâ (isteğe bağlı) | Kullanıcının kendi anahtarıyla [Anthropic](https://platform.claude.com/settings/keys), [OpenAI](https://platform.openai.com/api-keys) ya da [Google Gemini](https://aistudio.google.com/app/apikey) (ücretsiz katmanı var) | Anahtar yalnızca tarayıcıda durur (varsayılan sekme oturumu, "Bu cihazda hatırla" ile cihaz); çağrılar tarayıcıdan doğrudan sağlayıcıya gider, sunucumuza hiç uğramaz; kullanım kullanıcının hesabından ücretlendirilir. Model yalnızca çekilmiş mekân listesinden kimlikle seçer; cevap zod ile doğrulanır, liste dışı kimlikte bir kez daha sorulur, yine olmazsa deterministik plan kalır. Saat, açılış ve yürüme kurallarını uygulama hesaplar. Sohbet düzenlemeleri yapılandırılmış komutlardır (`&ai=…&edit=…` URL'de; anahtar asla URL'de değil). **Web'de ara:** modelin kendi web arama aracıyla uçuş fiyatı ve semte göre otel aralığı; Anthropic ve OpenAI'da yalnızca sağlayıcının kaynak listesindeki https sayfalara linklenen sonuçlar gösterilir, bütçenin para birimindeki karşılığı tahminidir, Travelpayouts'tan ayrı durur; Gemini'nin Google Search cevabı, kullanım koşulları gereği, kaynakları ve arama önerileriyle değiştirilmeden gösterilir (fiyat okunmaz, bütçeye kullanıcı yazar). Arama Anthropic ve OpenAI'da ayrıca ücretlendirilir; Gemini'nin ücretsiz katmanında arama yalnızca 2.5 modellerinde var ve Google bunları yeni hesaplara kapattı (ücretli katmanda ayda 5.000 arama ücretsiz). |
| Şehirler ve koordinatlar | [Wikidata](https://www.wikidata.org) | CC0. |
| Mekânlar (görülecek yer, müze, restoran, bar…) | [OpenStreetMap](https://www.openstreetmap.org/copyright), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) üzerinden | **ODbL 1.0.** `src/data/places/` OSM'den türetilmiş bir veritabanıdır ([lisans notu](src/data/places/README.md)); "© OpenStreetMap katkıcıları" atfı listede ve haritada. Veri `npm run data:places` ile önceden çekilir ve ayda bir tazelenir; uygulama çalışırken Overpass'a istek atmaz. |
| "Vikipedi'de N dilde" sıralaması | [Wikidata](https://www.wikidata.org) sitelinks (`wbgetentities`, 50'şerlik toplu istek) | CC0; tanımlayıcı User-Agent ile. |
| Önemli yerler, türleri, "içinde" bağları, kokteyl barları ve adlar | [Wikidata Query Service](https://query.wikidata.org) (şehir başına birkaç küçük SPARQL sorgusu, yalnızca veri script'inde) | CC0; tanımlayıcı User-Agent ile, istekler sırayla ve geri çekilmeyle. Latin harfli ad yoksa romanizasyon kod içindeki tablolarla yapılır (ICAO Doc 9303, ELOT 743, Korece Revised Romanization…). |
| Etkinlikler | [Wikidata](https://www.wikidata.org) (festival, karnaval, panayır, Noel pazarı, film ve müzik festivali serileri; `npm run data:events`, ayda bir) | CC0. Tarih yalnızca Wikidata'dan: edisyonun gün hassasiyetinde tarihi ya da serinin ayları ("GENELDE"); ikisi de yoksa etkinlik gösterilmez. Her kartta "Tarihleri resmî kaynaktan doğrula". |
| Şehir ve mekân fotoğrafları | [Wikimedia Commons](https://commons.wikimedia.org) (Wikidata P18) | Yalnızca CC0, kamu malı, CC BY ve CC BY-SA. Fotoğrafçı, lisans linki ve "renkleri düzenlendi" notu şehir fotoğrafının altında, mekân fotoğraflarında ayrıntı panelinde. Meta veri önceden çekilir; görsel Commons CDN'inden gelir. |
| Harita karoları | [OpenFreeMap](https://openfreemap.org) (OpenMapTiles şeması), [MapLibre GL JS](https://maplibre.org) ile | Ücretsiz, anahtarsız; "© OpenStreetMap katkıcıları · OpenFreeMap" atfı haritada. |

Her fiyat, kur ve etkinlik tarihi kaynağıyla gösterilir; bir kaynak cevap vermezse uygulama bunu açıkça söyler, tahmini ya da sabit değer uydurmaz. Sayfa sonunda da kaynaklar ve lisansları listelenir.

## Ölçüm

Yayındaki sitede ziyaretler [Vercel Web Analytics](https://vercel.com/docs/analytics) ile çerezsiz ve anonim sayılır. Ayrıntı [gizlilik sayfasında](https://vacationist-app.vercel.app/gizlilik).

- **Ölçülen:** hangi sayfanın açıldığı, yalnızca yolu (`/`, `/plan`…), ve Vercel'in standart alanları (ülke, tarayıcı, cihaz türü, başka siteden gelindiyse referrer).
- **Ölçülmeyen:** plan içeriğin. URL'deki şehir, tarih, kalkış, kişi, bütçe, çıkarılan duraklar, yapay zekâ seçimleri ve düzenlemeleri gönderilmeden önce atılır (`src/lib/analytics.ts`); custom event yok; yapay zekâ anahtarın ve sohbetin zaten sunucuya gelmez.
- **Nerede:** yalnızca production deployment'ında; geliştirmede, önizlemede ve yerel build'de betik yüklenmez. Betik ve gönderim kendi alan adımızdan (`/_vercel/insights/*`).
- **Kapatmak:** Vercel'de **Project → Analytics → Disable** ya da `src/app/_shell/RootDocument.tsx`'tan `<SiteAnalytics />` satırını kaldır. Ayrıntı: [docs/DEPLOY.md](docs/DEPLOY.md#7-ölçüm-vercel-web-analytics).

## Yerelde çalıştırma

Node 22 gerekir (`.nvmrc`).

```bash
npm ci
npm run dev
```

Uygulama <http://localhost:3000>'de açılır. Uçuşlar için `.env.example`'ı `.env.local` olarak kopyalayıp şu değişkenleri doldur (değerler yalnızca `.env.local`'de durur, asla commit'lenmez):

- `TRAVELPAYOUTS_TOKEN`
- `TRAVELPAYOUTS_MARKER`
- `TRAVELPAYOUTS_PROJECT_ID`

Token olmadan da her şey çalışır; uçuş bölümü bilet kartları yerine Aviasales ve Google Flights linklerini gösterir.

**Demo modları** (yalnızca yerelde, Vercel'de çalışmaz):

- `VA_AI_MOCK=1 npm run dev` — yapay zekâ ve web aramasını anahtarsız örnek cevaplarla açar; her sonuçta "ÖRNEK VERİ" yazar.
- `VA_FLIGHTS_FIXTURES=1 npm run dev` — token olmadan örnek uçuş verisi; sayfada "ÖRNEK VERİ · GERÇEK FİYAT DEĞİL" bandı görünür.
- `VA_RATES_FIXTURES=1` — canlı kur yerine kaydedilmiş bir TCMB bülteni (EUR, USD, JPY, KRW; GBP yok), "ÖRNEK VERİ (TCMB)" adıyla.

Sık kullanılan komutlar (tam liste ve ayrıntılar [AGENTS.md](AGENTS.md)'de):

| Komut | Ne yapar |
| --- | --- |
| `npm run lint` | ESLint (uyarı da hata sayılır) |
| `npm run typecheck` | Route tipleri + `tsc --noEmit` |
| `npm test` | Vitest birim testleri |
| `npm run build` | Üretim derlemesi |
| `npm run check:bundle` | Sunucuya özel veri ve token istemci paketine sızmamış mı |
| `npm run test:e2e` | Playwright uçtan uca testleri, axe erişilebilirlik ve klavye turu dahil (önce `npm run build`) |
| `npm run data:places` | Mekân verisini yeniden çeker (ağ ister, ~3 saat) |
| `npm run data:events` | Etkinlikleri Wikidata'dan yeniden çeker (ağ ister, şehir başına ~30 sn) |
| `npm run data:world-dots` | Ana sayfa arka planının nokta haritasını Natural Earth kara poligonlarından üretir (ağ ister, birkaç saniye) |
| `npm run data:origins` | Kalkış şehirlerini OurAirports, Wikidata ve GeoNames'ten yeniden çeker (ağ ister, ~1 dk) |
| `npm run data:airlines` | Havayolu adlarını Wikidata'dan yeniden çeker (ağ ister, birkaç saniye) |
| `npm run icons` | Uygulama ikonlarını ve favicon'u renk token'larından yeniden üretir |
| `npm run screenshots` | Build sonrası README görsellerini (`docs/screenshots/`) örnek veri modlarıyla yeniden üretir (Commons fotoğrafları için ağ ister) |

Vercel'e kurulum, ortam değişkenleri, Travelpayouts hesabı ve aylık veri yenileme: [docs/DEPLOY.md](docs/DEPLOY.md).

### Geliştirici notları

- Node 22 (`.nvmrc`). Komutlar için [AGENTS.md](AGENTS.md).
- Mekân verisi `src/data/places/` altında commit'lenir; elle tazelemek için `npm run data:places` (tüm şehirler, sırayla; yaklaşık üç saat; yarıda kalırsa aynı komut son 24 saatte çekilenleri atlayıp kaldığı yerden sürer, `-- --force` hepsini yeniden çeker) ya da `npm run data:places -- BCN SJJ`. Görülecek yer kuralları okurken uygulanır (`src/lib/places/rules.ts`, istisnalar `src/data/place-overrides.ts`); kural değiştirmek yeniden çekme gerektirmez. Tür etiketlerini ve `relink` istisnalarını yalnızca Wikidata'dan tazelemek için `npm run data:kinds` (birkaç dakika); bağlantı denetimi `npm run verify:place-links`.
- **Aylık tazeleme** (`.github/workflows/refresh-places.yml`) değişiklik varsa yeni bir branch'e commit atıp "chore: refresh place data" PR'ı açar. Bunun çalışması için repo ayarlarında **Settings → Actions → General → Workflow permissions** altında **"Allow GitHub Actions to create and approve pull requests"** seçeneği açık olmalı.
- **Uçuşlar:** `.env.example`'ı `.env.local` olarak kopyalayıp `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER` ve `TRAVELPAYOUTS_PROJECT_ID`'yi doldur (Vercel'de ortam değişkeni olarak). Partner link biçimini `npm run verify:partner-links` Travelpayouts'un partner link API'siyle karşılaştırır (ağ ister). Token yoksa uçuş bölümü kart yerine Aviasales ve Google Flights linklerini gösterir. Token olmadan arayüzü görmek için `VA_FLIGHTS_FIXTURES=1` örnek veriyi açar; sayfa bunu "ÖRNEK VERİ · GERÇEK FİYAT DEĞİL" bandıyla belirtir ve bu mod Vercel'de çalışmaz.
- `GITHUB_TOKEN` ile açılan PR'lar başka workflow'ları tetiklemez; tazeleme PR'ında CI'ı merge'den önce elle çalıştır (testler tazeleme workflow'unun içinde zaten koşar).

## Kalite

- **Testler:** {UNIT} birim ve bileşen testi ({UNITFILES} dosya, Vitest) ve {E2E} uçtan uca test ({E2EFILES} Playwright dosyası); hepsi CI'da her push ve PR'da koşar, birim testleri beş saat dilimi/saat birleşiminde.
- **Erişilebilirlik:** açık ve koyu temada axe (ciddi/kritik ihlal sıfır), ana sayfadan bütçeye klavyeyle tam tur, her renk token'ı için WCAG AA kontrastı, telefonda 44 px dokunma alanı ve 12 px'ten küçük yazı yok.
- **Lighthouse:** son ölçüm (2026-11-06, üretim build'i, 3 ölçümün medyanı) ana sayfa mobil 89 / 100 / 100 / 100, masaüstü 100 / 100 / 100 / 100; plan mobil 81 / 100 / 100 / 92\*, masaüstü 95 / 100 / 100 / 92\* (Performance / Accessibility / Best Practices / SEO). \* Plan sayfası bilerek `noindex`. Ayrıntı: [docs/DEPLOY.md](docs/DEPLOY.md#son-lighthouse-ölçümü).

## Yol haritası

[docs/BACKLOG.md](docs/BACKLOG.md)'den: Gemini grounding'in başarılı yolunu gerçek bir cevapla doğrulamak; Wikidata'da tarihi eksik büyük etkinlikler (Venedik Karnavalı, Edinburgh Fringe) eklenince aylık yenilemede gelmeleri; bir otel partner programı onaylanınca gerçek otel fiyatları.

## Katkı

Hata bildirimi ve PR'lar memnuniyetle karşılanır.

- Önce [AGENTS.md](AGENTS.md) (çalışma kuralları), [docs/DESIGN.md](docs/DESIGN.md) (görsel dil) ve [docs/PRD.md](docs/PRD.md) (ürün gereksinimleri).
- Her iş kendi branch'inde: `feat/…`, `fix/…`, `docs/…`, `chore/…`; commit mesajları İngilizce, Conventional Commits.
- PR'dan önce `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundle` ve `npm run test:e2e` geçmeli.
- Kurallar: yalnızca ücretsiz servisler, kazıma yok, uydurma veri yok; arayüz metinleri Türkçe ve İngilizce, yalnızca `src/i18n/messages/` altındaki mesaj dosyalarından (iki dosyanın anahtarları aynı); ham renk değeri yalnızca `src/app/globals.css`'te.
- Gizli anahtarlar asla commit'lenmez.

Belgeler: [PRD](docs/PRD.md) · [DESIGN](docs/DESIGN.md) · [PLAN](docs/PLAN.md) · [DEPLOY](docs/DEPLOY.md) · [BACKLOG](docs/BACKLOG.md) · [AGENTS](AGENTS.md)

## Lisans

Kod: [MIT](LICENSE). `src/data/places/` altındaki OSM türevi veri: [ODbL 1.0](src/data/places/README.md). `src/data/origins.json`: OurAirports (kamu malı), Wikidata (CC0) ve saat dilimleri için GeoNames ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)); `src/data/airlines.json` ve `src/data/events/`: Wikidata (CC0). `src/data/world-dots.json`: Natural Earth (kamu malı). Open Graph kartlarındaki fontlar (`assets/og/`): SIL Open Font License 1.1. Her Commons fotoğrafı kendi lisansıyla, yazarı ve lisansı yanında gösterilir.
