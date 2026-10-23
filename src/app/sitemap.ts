import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

/** Only the home page is indexed; plans are personal links (noindex) and the style guide is a tool. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "monthly", priority: 1 }];
}
