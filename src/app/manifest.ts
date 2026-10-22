import type { MetadataRoute } from "next";
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    lang: "tr",
    start_url: "/",
    display: "browser",
    icons: [{ src: "/favicon.ico", sizes: "48x48 32x32 16x16", type: "image/x-icon" }],
  };
}
