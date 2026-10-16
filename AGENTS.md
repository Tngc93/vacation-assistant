# AGENTS.md — Vacation Assistant

Vacation Assistant, Türkiye'den (İstanbul ya da Ankara) yurt dışına kısa şehir tatili planlayan gezginler için açık kaynak bir web uygulamasıdır. Tek ekranda en ucuz uçuşu (IST / SAW / ESB), Türk pasaportu için vize durumunu, TL cinsinden toplam bütçeyi ve gün gün şehir planını gösterir. Uygulama yapay zekâ olmadan tam çalışır; kullanıcı isterse kendi yapay zekâ anahtarını tarayıcıda bağlayıp planı sohbetle değiştirebilir. Tamamen ücretsiz servislerle çalışır ve Vercel'de yayınlanır.

## Kaynak belgeler

- [docs/PRD.md](docs/PRD.md) — ürün gereksinimleri (madde numaraları PLAN.md'de referans verilir)
- [docs/DESIGN.md](docs/DESIGN.md) — "Travel journal" görsel dili, token'lar, tipografi, imza bileşenler
- [docs/PLAN.md](docs/PLAN.md) — adım adım yapım planı (bir adım = bir branch = bir PR)

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| _(adım 1'de doldurulacak)_ | |

## Çalışma kuralları

- **Branch ve PR:** Her iş PLAN.md'deki gibi kendi branch'inde yapılır (`feat/…`, `fix/…`, `chore/…`). `main`'e doğrudan commit ya da push yok. PR açmadan önce Berk'e sorulur.
- **Tamamen ücretsiz:** Ücretli servis, kredi kartı isteyen API ya da ücretli paket yok. Emin değilsen sor.
- **Kazıma yok:** Uçuş, otel ya da arama sitelerini kazıma (scraping) yok. Veri yalnızca PRD'deki kaynaklardan gelir.
- **Gizli anahtarlar:** Yalnızca `.env.local`'de ve Vercel ortam değişkenlerinde durur. Asla commit'lenmez, asla istemciye gitmez. `.env.example`'da yalnızca değişken adları olur.
- **Kullanıcının yapay zekâ anahtarı:** Yalnızca tarayıcıda tutulur, sunucuya kaydedilmez ve loglanmaz.
- **Dürüst veri:** Her fiyat ve tahmin kaynağını ve "tahmini" etiketini gösterir. Uydurma veri yok. Bir kaynak cevap vermezse bunu açıkça göster.
- **Dil:** Arayüz metinleri Türkçe; kod, yorumlar ve commit mesajları İngilizce.
- **Tasarım:** Görsel kararlar DESIGN.md'ye uyar. Ham hex renk yok, yalnızca token'lar.
- **Kalite kapısı:** Bir adımı bitirmeden önce lint, typecheck ve test geçmeli.
