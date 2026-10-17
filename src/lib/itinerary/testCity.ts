// A synthetic city for tests: three areas about 2 km apart, ten sights each, evening places near each.
import type { PlanPlace } from "./plan";

const AREAS = [
  { lat: 41.39, lon: 2.17 },
  { lat: 41.408, lon: 2.17 },
  { lat: 41.39, lon: 2.194 },
];
const CATS = ["see", "museum", "viewpoint", "see", "museum", "see", "viewpoint", "see", "museum", "see"] as const;

export const SIGHTS: PlanPlace[] = AREAS.flatMap((area, a) =>
  CATS.map((category, i) => ({
    id: `node/${(a + 1) * 100 + i}`,
    name: `Sight ${a}-${i}`,
    lat: area.lat + (i % 5) * 0.0008,
    lon: area.lon + Math.floor(i / 5) * 0.0012 + (i % 5) * 0.0004,
    category,
    // Area 0 holds the most important sight; counts never tie.
    wikipediaCount: 90 - a * 10 - i,
    address: `Street ${a}-${i}`,
  })),
);

export const EVENING: PlanPlace[] = AREAS.flatMap((area, a) =>
  [0, 1].map((i) => ({
    id: `way/${(a + 1) * 10 + i}`,
    name: `Dinner ${a}-${i}`,
    lat: area.lat + 0.004 + i * 0.0005,
    lon: area.lon + 0.002,
    category: "restaurant" as const,
    openingHours: "Mo-Su 12:00-23:00",
    ...(i === 0 ? { detailed: true as const } : {}),
  })),
);
