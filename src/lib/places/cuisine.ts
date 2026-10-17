/**
 * Turkish names for the 50 most common OSM `cuisine` values in our place data
 * (about 84% of all values). Keys are OSM values; stored values use spaces
 * instead of underscores ("coffee shop"), so lookups normalise first.
 */
export const CUISINE_TR: Readonly<Record<string, string>> = {
  coffee_shop: "Kahve",
  italian: "İtalyan",
  regional: "Yöresel",
  pizza: "Pizza",
  burger: "Burger",
  sandwich: "Sandviç",
  breakfast: "Kahvaltı",
  cake: "Pasta",
  international: "Uluslararası",
  french: "Fransız",
  japanese: "Japon",
  tea: "Çay",
  ice_cream: "Dondurma",
  local: "Yerel",
  indian: "Hint",
  mediterranean: "Akdeniz",
  seafood: "Deniz ürünleri",
  asian: "Asya",
  american: "Amerikan",
  pasta: "Makarna",
  spanish: "İspanyol",
  chinese: "Çin",
  steak_house: "Steakhouse",
  tapas: "Tapas",
  mexican: "Meksika",
  georgian: "Gürcü",
  sushi: "Suşi",
  thai: "Tayland",
  greek: "Yunan",
  german: "Alman",
  chicken: "Tavuk",
  salad: "Salata",
  grill: "Izgara",
  dessert: "Tatlı",
  bubble_tea: "Bubble tea",
  brunch: "Brunch",
  barbecue: "Mangal",
  korean: "Kore",
  fish: "Balık",
  italian_pizza: "İtalyan pizzası",
  arab: "Arap",
  portuguese: "Portekiz",
  irish: "İrlanda",
  coffee: "Kahve",
  turkish: "Türk",
  pancake: "Pankek",
  kebab: "Kebap",
  bagel: "Bagel",
  pastry: "Hamur işi",
  balkan: "Balkan",
};

/** First letter upper-cased the plain way: these are English OSM words, so "indian" must not become "İndian". */
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "indian, pizza" → "Hint, Pizza". Values outside the dictionary are kept,
 * only capitalised ("catalan" → "Catalan"); repeated names are shown once.
 */
export function describeCuisine(value: string): string {
  const names = value
    .split(/[,;]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => CUISINE_TR[part.replace(/\s+/g, "_")] ?? capitalise(part.replace(/_/g, " ")));
  return [...new Set(names)].join(", ");
}
