import { Fraunces, Geist, Geist_Mono } from "next/font/google";

// Fonts are self-hosted by next/font at build time. The CSS carries every subset (latin-ext has the Turkish ğ, İ,
// ş); `subsets` only picks what is preloaded. Preloading latin alone keeps six font files from competing with the
// first photo on a phone; latin-ext follows as soon as the page uses one of its letters.
export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-fraunces",
  display: "swap",
});

export const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
