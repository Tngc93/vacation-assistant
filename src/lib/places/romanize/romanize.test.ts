import { describe, expect, it } from "vitest";
import { readableName } from "../names";
import { decompose, romanizeHangulWord } from "./hangul";
import { romanize } from ".";

const each = (countryCode: string, cases: Record<string, string>) => {
  for (const [name, latin] of Object.entries(cases)) expect(romanize(name, countryCode), name).toBe(latin);
};

describe("romanize: each country's official system", () => {
  it("Russian: ICAO Doc 9303 (Russian passports)", () => {
    each("RU", {
      "Красная площадь": "Krasnaia ploshchad",
      Москва: "Moskva",
      Щукин: "Shchukin",
      Юлия: "Iuliia",
      Пётр: "Petr",
      Объект: "Obieekt",
      Наталья: "Natalia",
      "Зимний дворец": "Zimnii dvorets",
      Жуковский: "Zhukovskii",
      Хабаровск: "Khabarovsk",
      Эрмитаж: "Ermitazh",
      ЦУМ: "TSUM",
    });
  });

  it("Serbian: the official Latin alphabet, letter for letter (also in Bosnia)", () => {
    each("RS", {
      Београд: "Beograd",
      Ђурђевдан: "Đurđevdan",
      Ћирилица: "Ćirilica",
      Љубљана: "Ljubljana",
      Његош: "Njegoš",
      Џеп: "Džep",
      Шабац: "Šabac",
      "Калемегдан": "Kalemegdan",
      "Кафана СФРЈ": "Kafana SFRJ",
    });
    expect(romanize("Вијећница", "BA")).toBe("Vijećnica");
  });

  it("Bulgarian: the Streamlined System (2009), -ия at a word's end is -ia", () => {
    each("BG", {
      София: "Sofia",
      Търново: "Tarnovo",
      Самоков: "Samokov",
      Благоевград: "Blagoevgrad",
      Щърбанов: "Shtarbanov",
      Ягодово: "Yagodovo",
      Юлиан: "Yulian",
      Йордан: "Yordan",
      Гьоте: "Gyote",
      Жеравна: "Zheravna",
      Харманли: "Harmanli",
      Цар: "Tsar",
      "Килията на Васил Левски": "Kiliyata na Vasil Levski",
    });
  });

  it("Macedonian: the official digraph system (2008)", () => {
    each("MK", {
      Скопје: "Skopje",
      Охрид: "Ohrid",
      "Ѓорче Петров": "Gjorche Petrov",
      Кичево: "Kichevo",
      Ќерка: "Kjerka",
      Ѕвезда: "Dzvezda",
      Џамија: "Djamija",
      Жеден: "Zheden",
      Центар: "Centar",
      Шуто: "Shuto",
      Љубојно: "Ljubojno",
      Њивиште: "Njivishte",
    });
  });

  it("Uzbek (Cyrillic, with a letter of its own): the official Latin alphabet; else Russian", () => {
    each("UZ", {
      Ўзбекистон: "Oʻzbekiston",
      Қорақалпоғистон: "Qoraqalpogʻiston",
      "Мустақиллик майдони": "Mustaqillik maydoni",
      Самарқанд: "Samarqand",
      Шайхонтоҳур: "Shayxontohur",
      "Ер ости қасри": "Yer osti qasri",
      Маъқул: "Maʼqul",
      // No Uzbek letter: Russian, as most of Tashkent's Cyrillic names are.
      Обсерватория: "Observatoriia",
      "Музей Авиации": "Muzei Aviatsii",
    });
  });

  it("Greek: ELOT 743, without accents", () => {
    each("GR", {
      Αθήνα: "Athina",
      Θεσσαλονίκη: "Thessaloniki",
      Πειραιάς: "Peiraias",
      Ευαγγελισμός: "Evangelismos",
      Ευκλείδης: "Efkleidis",
      Ναύπλιο: "Nafplio",
      Μπουμπουλίνας: "Boumpoulinas",
      Χανιά: "Chania",
      Ψυχικό: "Psychiko",
      Γλυφάδα: "Glyfada",
      Άγγελος: "Angelos",
      Ηράκλειο: "Irakleio",
      Σύνταγμα: "Syntagma",
      Κουκάκι: "Koukaki",
      Πρωτεύουσα: "Protevousa",
      ΣΥΝΤΑΓΜΑ: "SYNTAGMA",
    });
  });

  it("Georgian: the national system (2002), apostrophes for the ejectives", () => {
    each("GE", {
      თბილისი: "Tbilisi",
      ქუთაისი: "Kutaisi",
      მცხეთა: "Mtskheta",
      ბათუმი: "Batumi",
      ზუგდიდი: "Zugdidi",
      წყალტუბო: "Ts'q'alt'ubo",
      ჭიათურა: "Ch'iatura",
      ფოთი: "Poti",
      ჟინვალი: "Zhinvali",
      "ქართული სახლი": "Kartuli Sakhli",
      ღვინო: "Ghvino",
    });
  });

  it("Korean: the Revised Romanization, from the sounds", () => {
    each("KR", {
      경복궁: "Gyeongbokgung",
      창덕궁: "Changdeokgung",
      종로: "Jongno",
      신라: "Silla",
      한라산: "Hallasan",
      왕십리: "Wangsimni",
      독립문: "Dongnimmun",
      청량리: "Cheongnyangni",
      국립중앙박물관: "Gungnipjungangbangmulgwan",
      북한산: "Bukhansan",
      압구정: "Apgujeong",
      "서울의 밤풍경": "Seourui Bampunggyeong",
      "TACO DE BURRO (타코 드 부로)": "TACO DE BURRO (Tako Deu Buro)",
    });
  });
});

describe("Hangul", () => {
  it("splits a syllable into initial, vowel and final", () => {
    expect(decompose("한")).toEqual({ initial: "ㅎ", vowel: 0, final: "ㄴ" });
    expect(decompose("가")).toEqual({ initial: "ㄱ", vowel: 0, final: "" });
    expect(decompose("닭")).toEqual({ initial: "ㄷ", vowel: 0, final: "ㄺ" });
    expect(decompose("의")).toEqual({ initial: "ㅇ", vowel: 19, final: "" });
    expect(decompose("힣")).toEqual({ initial: "ㅎ", vowel: 20, final: "ㅎ" });
  });

  it("applies the sound changes between syllables", () => {
    const cases: Record<string, string> = {
      // Liaison, and a cluster before a vowel.
      한국어: "hangugeo",
      닭이: "dalgi",
      // Nasalization.
      백마: "baengma",
      국민: "gungmin",
      십리: "simni",
      // ㄹ: after ㄴ (ll), after ㄹ, before ㄴ, after ㅁ or ㅇ (n).
      별내: "byeollae",
      울릉: "ulleung",
      침략: "chimnyak",
      // Palatalization.
      해돋이: "haedoji",
      같이: "gachi",
      // ㅎ: aspiration before ㄱ ㄷ ㅈ, silent before a vowel, ㄴ before ㄴ; kept after ㄱ ㄷ ㅂ in nouns.
      좋고: "joko",
      놓다: "nota",
      좋아: "joa",
      많이: "mani",
      놓는: "nonneun",
      묵호: "mukho",
      집현전: "jiphyeonjeon",
      // Finals before a consonant and at a word's end; tense consonants are not written.
      벚꽃: "beotkkot",
      한밭: "hanbat",
      월곶: "wolgot",
      닭: "dak",
      낙동강: "nakdonggang",
    };
    for (const [word, latin] of Object.entries(cases)) expect(romanizeHangulWord(word), word).toBe(latin);
  });
});

describe("what is not romanized", () => {
  it("never touches a place that has a Latin name", () => {
    expect(romanize("Park Güell", "ES")).toBeUndefined();
    expect(romanize("Kızıl Meydan", "RU")).toBeUndefined();
    expect(readableName({ name: "Московский Кремль", labels: { en: "Moscow Kremlin" } }, "RU")).toEqual({
      name: "Moscow Kremlin",
      localName: "Московский Кремль",
    });
    expect(readableName({ name: "Кофемания", osmNames: { en: "Coffeemania" } }, "RU").name).toBe("Coffeemania");
    expect(readableName({ name: "Kızıl Meydan", localName: "Красная площадь" }, "RU")).toEqual({ name: "Kızıl Meydan", localName: "Красная площадь" });
  });

  it("leaves Japanese, Chinese, Arabic and Thai as they are", () => {
    expect(romanize("東京タワー", "JP")).toBeUndefined();
    expect(romanize("浅草寺", "JP")).toBeUndefined();
    expect(romanize("马来西亚陈嘉庚纪念馆", "MY")).toBeUndefined();
    expect(romanize("دار الباشا", "TN")).toBeUndefined();
    expect(romanize("متحف قطر الوطني", "QA")).toBeUndefined();
    expect(romanize("วัดพระแก้ว", "TH")).toBeUndefined();
    expect(readableName({ name: "東京タワー" }, "JP")).toEqual({ name: "東京タワー" });
    expect(readableName({ name: "دار الباشا" }, "MA")).toEqual({ name: "دار الباشا" });
  });

  it("needs the language of the city's country, confirmed by the letters", () => {
    // A Greek bar name in Cologne, a Russian name in Sofia (ы is not Bulgarian), Cyrillic in Seoul.
    expect(romanize("ΙΧΩΡ Night Club", "DE")).toBeUndefined();
    expect(romanize("Брынза", "BG")).toBeUndefined();
    expect(romanize("Брынза", "RU")).toBe("Brynza");
    expect(romanize("Москва", "KR")).toBeUndefined();
    // Hangul with Hanja, Russian with Chinese: not wholly romanizable, so not at all.
    expect(romanize("경복궁 景福宮", "KR")).toBeUndefined();
    expect(romanize("Ресторан 容龍", "RU")).toBeUndefined();
  });
});
