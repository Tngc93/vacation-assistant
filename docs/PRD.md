---
type: prd
---

# PRD: Vacationist

Sahibi: Berk Arcak · Durum: Taslak · Faz: 1 (web, Türkiye'den çıkış)

## Problem

Türkiye'den yurt dışına tatil planlayan biri bugün en az beş farklı yere bakıyor: uçuş için bir arama sitesi, otel için başka bir site, vize için Dışişleri ve forumlar, kur için banka uygulaması, gezilecek yer ve mekânlar için bloglar ve haritalar. Hiçbiri toplam maliyeti TL olarak tek ekranda göstermiyor. Global yapay zekâ planlayıcıları (Mindtrip, Layla, Wanderlog) ise Türk pasaportunun vize durumunu, İstanbul'daki iki havalimanı ile Ankara arasındaki fiyat farkını ve bütçeyi TL olarak hesaba katmıyor.

## Kullanıcılar

- **Birincil:** İstanbul ya da Ankara'dan kısa şehir tatili (2–7 gün) planlayan, bütçesine dikkat eden 22–40 yaş arası gezgin.
- **İkincil:** Kendi yapay zekâ hesabını (Claude, ChatGPT, Gemini) bağlayıp planı sohbetle değiştirmek isteyen teknik kullanıcı.

## Hedefler ve metrikler

| Metrik | Mevcut | Hedef | Tarih |
| --- | --- | --- | --- |
| Arama ekranından ilk tam plana geçen süre (yapay zekâsız) | yok (ürün yok) | 10 saniyenin altında | 31 Aralık 2026 |
| Yayındaki sitede oluşturulan plan sayısı (haftalık) | 0 | 200 | 31 Mart 2027 |
| GitHub yıldızı | 0 | 100 | 31 Mart 2027 |
| Aylık işletme maliyeti | 0 TL | 0 TL (koruma metriği) | sürekli |

**Plan sayısı nasıl ölçülür:** Vercel Web Analytics'te (Hobby, ücretsiz) `/plan` sayfa görüntülemesi. Sorgu parametreleri ölçüme gitmez, custom event yok; bu yüzden hangi şehir ya da tarih planlandığı bilinmez. Plan içindeki değişiklikler (tarih, bütçe, durak çıkarma, yapay zekâ) yeni görüntüleme sayılmaz; aynı planın yeniden açılması ve rotasız `/plan` sayılır, yani sayı üst sınırdır. Hobby'de rapor penceresi 1 ay; haftalık değer panelde son 7 gün seçilerek okunur. Ayrıntı: [DEPLOY.md](DEPLOY.md#7-ölçüm-vercel-web-analytics).

## Kapsam dışı

- Kullanıcı kaydı, giriş ve kayıtlı planlar (faz 3).
- Uygulama içinden bilet ya da otel satın alma. Satın alma her zaman sağlayıcının sitesinde yapılır.
- Ücretli bir veri ya da yapay zekâ servisine bağımlılık.
- Uçuş sitelerini (Google Flights, Skyscanner, havayolu siteleri) doğrudan kazıma. Kullanım koşullarını ihlal eder, bot korumasına takılır ve sık bozulur.
- Mobil uygulama (faz 3).
- Türkiye dışından çıkış (faz 2).

## Gereksinimler

### Arama ekranı

1. Kullanıcı çıkış şehrini seçer: İstanbul ya da Ankara. İstanbul seçildiğinde IST ve SAW birlikte, Ankara seçildiğinde ESB aranır. *Ana sayfadan plan sayfasının Uçuşlar bölümüne taşındı (2026-10-22, Berk'in kararı); varsayılan İstanbul (IST + SAW).*
2. Kullanıcı varış ülkesini ve şehrini, gidiş ve dönüş tarihlerini ve kişi sayısını (1–9) seçer. *Ana sayfa yalnızca varış şehrini ve tarihleri sorar; kişi sayısı plan sayfasının Konaklama ve Uçuşlar bölümlerine taşındı, varsayılan 1 (2026-10-22, Berk'in kararı).*
3. Arama durumu URL'de tutulur. Link paylaşıldığında aynı plan açılır (kayıt gerekmeden paylaşım). *`from` ve `pax` isteğe bağlı (varsayılanlar URL'ye yazılmaz); bunları içeren eski linkler aynı planı açar (2026-10-22).*

### Uçuşlar

4. Uçuş fiyatları Travelpayouts (Aviasales) Data API'sinden sunucu tarafında çekilir. Token yalnızca ortam değişkeninde durur, istemciye gönderilmez.
5. Sonuçlar havalimanına göre gruplanır (IST / SAW / ESB) ve en ucuz seçenek işaretlenir.
6. Aktarmasız uçuş varsa ayrı bir filtreyle gösterilir. Yoksa "bu tarihlerde aktarmasız uçuş bulunamadı" yazar.
7. Her fiyatın yanında "önbellekten, son 48 saatteki aramalara dayalı tahmini fiyat" etiketi ve sağlayıcı sitesinde hazır doldurulmuş aramayı açan "Güncel fiyatı gör" butonu bulunur.
8. Kullanıcı kendi yapay zekâ hesabını bağladıysa "Web'de ara" butonu, modelin web arama aracıyla güncel fiyat arar. Bu sonuçlar kaynak linkiyle ve "yapay zekâ web'den buldu, satın almadan önce doğrula" etiketiyle ayrı listelenir.

### Konaklama

9. Faz 1'de ücretsiz bir gerçek zamanlı otel fiyat kaynağı olmadığı için otel kartı semte göre bir fiyat aralığı gösterir. Bu aralık bağlı yapay zekâ ile web'den bulunur. Yapay zekâ yoksa kart yalnızca semt önerisini ve linkleri gösterir.
10. "Otelleri gör" butonu Booking ve Google Hotels'te tarih ve kişi sayısı doldurulmuş aramayı açar.

### Vize

11. Türk pasaportu için vize durumu ve vizesiz kalış süresi, açık kaynak passport-index-dataset verisinden build sırasında okunur. *Faz 1 arayüzünden kaldırıldı (2026-10-21, Berk'in kararı); veri ve bileşen kodda duruyor.*
12. Kartta verinin son güncelleme tarihi ve "resmî bilgi için" Dışişleri Bakanlığı linki bulunur. *Faz 1 arayüzünden kaldırıldı (2026-10-21, Berk'in kararı); veri ve bileşen kodda duruyor.*

### Bütçe

13. Toplam bütçe TL olarak gösterilir: uçuş (kişi × fiyat) + konaklama (gece × fiyat aralığı) + günlük harcama (gün × kişi × şehir tahmini).
14. Döviz kurları TCMB'nin günlük kur dosyasından sunucu tarafında çekilir ve günde bir kez önbelleğe alınır. TCMB'ye ulaşılamazsa Frankfurter (ECB) kullanılır.
15. Her bütçe satırında kaynağı ve "tahmini" etiketi bulunur. Kullanıcı günlük harcama tahminini elle değiştirebilir.

### Şehir rehberi

16. Görülecek yerler, restoranlar ve eğlence mekânları OpenStreetMap (Overpass API) verisinden çekilir.
17. Kategori filtreleri: görülecek yer, müze, manzara noktası, restoran, kafe, kokteyl bar, bar ve pub, gece kulübü. Kullanıcı her birini açıp kapatabilir.
18. "Mutlaka görülmeli" sıralaması Wikidata'daki Vikipedi dil sayısına göre yapılır.
19. Mekânlar MapLibre ve OpenFreeMap karoları ile ücretsiz bir harita üzerinde gösterilir.
19a. **Etkinlikler** (2026-10-28, Berk; kaynak yalnızca Wikidata): kullanıcının tarihlerinde şehirde büyük, yıllık bir etkinlik (festival, karnaval, panayır, Noel pazarı, film ya da müzik festivali) varsa "Etkinlik" çipiyle gösterilir; çakışan yoksa çip çıkmaz. Wikidata'da gün hassasiyetinde edisyon tarihi varsa kesin tarih ("14 KAS – 18 KAS"), yoksa serinin ayları "genelde" etiketiyle ("GENELDE EYLÜL–EKİM · TARİHİ DOĞRULA"); ikisi de yoksa etkinlik gösterilmez, tarih tahmin edilmez. Kesin etkinlik masthead'de ("BU TARİHLERDE: …") ve gün gün planda o günlerin başlığında not olarak görünür; plana durak eklenmez. Her kartta kaynak (Wikidata), varsa resmî site ve "Tarihleri resmî kaynaktan doğrula". Yetişkin içerikli etkinlikler (erotik, fetiş, pornografik; türe, konuya ya da ada göre) gösterilmez.

### Gün gün plan

20. Yapay zekâ bağlı değilse plan deterministik kurulur: mekânlar yakınlığa göre günlere bölünür, her gün en fazla 4 durak ve 1 akşam mekânı içerir.
21. Yapay zekâ bağlıysa plan model tarafından yazılır, ama yalnızca 16. maddede çekilen mekân listesinden seçim yapabilir. Liste dışı mekân üretemez. Çıktı bir JSON şemasıyla doğrulanır.
22. Kullanıcı planı sohbetle değiştirebilir ("2. günü müzesiz yap", "daha ucuz akşam yemeği").

### Yapay zekâ bağlantı ekranı

23. Kullanıcı sağlayıcı (Anthropic, OpenAI, Google Gemini) seçer ve kendi API anahtarını girer.
24. Anahtar yalnızca kullanıcının tarayıcısında tutulur. "Bu cihazda hatırla" kapalıysa sekme kapanınca silinir. Sunucuya kaydedilmez ve loglanmaz.
25. Yapay zekâ bağlı olmadan uygulamanın 1–7, 9–20. maddeleri tam çalışır.
26. Ekranda, ücretsiz katmanı olan sağlayıcılara ve anahtar alma sayfalarına link bulunur.

## Teknik çerçeve

- Next.js (App Router) + TypeScript, Vercel üzerinde yayın. Vercel Hobby planı ticari olmayan kullanım içindir; affiliate geliri başlarsa Netlify'a ya da ücretli plana geçiş değerlendirilir.
- Yapay zekâ çağrıları sağlayıcıdan bağımsız bir katmanla yapılır (universal-llm-client deseni: fallback, JSON şema doğrulama, mock sağlayıcı).
- Testler ve demolar için anahtarsız bir mock sağlayıcı bulunur.

## Yayın planı

- **Faz 1 (bu PRD):** İstanbul ve Ankara çıkışlı web uygulaması, GitHub'da açık kaynak, Vercel'de yayında.
- **Faz 2:** İzmir ve Antalya çıkışları, gerçek otel fiyat API'si (affiliate onayı ile), PWA.
- **Faz 3:** Kullanıcı kaydı, kayıtlı planlar, mobil uygulama.

## Açık sorular

| Soru | Sahibi | Ne zamana |
| --- | --- | --- |
| ~~Arayüzde görünen Türkçe marka adı ne olacak? (repo adı: vacation-assistant)~~ **Kapandı:** Vacationist, 2026-10-22, Berk. Alt başlık: "Kısa şehir kaçamakları için planlayıcı". Repo, paket, Vercel proje adı ve URL'ler değişmez. | Berk | 23 Ekim 2026 |
| Travelpayouts partner onayı Türkiye çıkışlı rotalarda yeterli veri veriyor mu? | Berk (hesap açar) + Claude Code (veriyi test eder) | 23 Ekim 2026 |
| Günlük harcama tahmini için hangi şehir listesiyle başlıyoruz (ilk 30 şehir)? | Berk | 30 Ekim 2026 |
| Gemini ücretsiz katmanındaki web arama limiti tek kullanıcı için yeterli mi? **Dokümana göre (21 Ekim 2026):** ücretsiz katmanda Google Search grounding yalnızca Gemini 2.5 Flash ve 2.5 Flash-Lite'ta var, ikisine ortak günde 500 istek; Gemini 3 modellerinde ücretsiz katmanda yok (ücretli katmanda ayda 5.000 ücretsiz, sonra 1.000 istekte 14 $). Kaynak: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), sayfa 19 Ekim 2026'da güncellenmiş. **Güncelleme (checked 2026-10-21, gerçek test + dokümanlar):** yeni hesaplarda ücretsiz Gemini web araması **yok**. Google 2.5 modellerine erişimi yalnızca bunları daha önce kullanmış hesaplara açıyor ("we are limiting access to the 2.5 models to users who have actively used them in the past", [ai.google.dev/gemini-api/docs/deprecations](https://ai.google.dev/gemini-api/docs/deprecations)); yeni bir anahtarla `gemini-2.5-flash` HTTP 404 döndü. Pricing sayfasında Gemini 3.x modellerinin hepsinde (3.6/3.8 Flash, 3.5/3.1 Flash-Lite) ücretsiz katmanın "Grounding with Google Search" hücresi "Not available"; gerçek testte Gemini 3.6 Flash araması ayrıntısız 429 verdi. Sonuç: 500/gün yalnızca 2.5'e erişimi süren eski hesaplar için geçerli; yeni hesaplarda Gemini ile web araması ücretli katman ister (ayda 5.000 arama ücretsiz), ya da Anthropic/OpenAI bağlanır. Gemini aramasının başarılı yolu gerçek bir cevapla henüz doğrulanmadı (BACKLOG). | Claude Code (dener) | 30 Ekim 2026 |
