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
| Şehirler ve koordinatlar | [Wikidata](https://www.wikidata.org) | CC0. |

Her fiyat, kur ve vize bilgisi kaynağıyla ve tarihiyle gösterilir; bir kaynak cevap vermezse uygulama bunu açıkça söyler, tahmini ya da sabit değer uydurmaz.

## Lisans

[MIT](LICENSE)
