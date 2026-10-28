# Backlog

Yapılması kararlaştırılmış ama henüz bir branch'e alınmamış işler. Bir madde ele alınınca kendi branch'inde yapılır ve buradan silinir.

## Yapay zekâ

1. **Gemini grounding'in başarılı yolu doğrulanmadı:** Gemini grounding'in başarılı yolu (searchEntryPoint render, kaynak linkleri) gerçek bir cevapla doğrulanmadı; ücretli ya da 2.5 erişimi olan bir anahtarla denenecek.

## Mekân verisi

2. **Kremlin adı:** Wikidata TR etiketi 'Kremlini'; place-overrides ile 'Moskova Kremlini' yap (ya da Wikidata etiketi düzeltilince kaldır).
3. **Latin dışı kalan 242 ad:** Kiril, Yunan ve Hangul için kurallı transliterasyon (ör. ISO 9, ELOT 743, Revised Romanization) değerlendirilecek; Japonca/Arapça kapsam dışı.

## Etkinlikler

4. **Eksik Wikidata tarihleri:** Venedik Karnavalı, Edinburgh Fringe gibi büyük etkinliklerde Wikidata'da ay/tarih (P2922 ya da edisyon P580/P582) eksik; Wikidata'ya eklenirse aylık yenilemede otomatik gelir.

## Test

5. **Flaky klavye testi:** e2e klavye testi (`e2e/keyboard.spec.ts`) tam pakette ara sıra flaky (2026-10-28); kök nedeni araştırılacak.
