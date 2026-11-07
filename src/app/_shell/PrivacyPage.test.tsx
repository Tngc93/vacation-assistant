import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { REPO_URL } from "@/lib/brand";
import { PRIVACY_STORAGE, PRIVACY_UPDATED, PrivacyPage } from "./PrivacyPage";

/** Where each key the page names is defined: the page must not name a key the code does not use. */
const SOURCES = [
  "src/lib/theme.ts",
  "src/lib/budget/currency.ts",
  "src/data/origins.ts",
  "src/lib/ai/keyStore.ts",
  "src/lib/ai/webCache.ts",
  "src/components/ai/WebSearchParts.tsx",
  "public/sw.js",
].map((file) => readFileSync(file, "utf8"));

describe("privacy page", () => {
  it("names only storage keys and caches the code uses", () => {
    const keys = PRIVACY_STORAGE.flatMap((group) => group.entries.map((entry) => entry.key.replace("…", "")));
    for (const key of keys) expect(SOURCES.some((source) => source.includes(`"${key}`)), key).toBe(true);
  });

  it("renders in Turkish with its sections, the update date and the GitHub Issues link", () => {
    render(<PrivacyPage locale="tr" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hesap yok, çerez yok");
    const contents = screen.getByRole("navigation", { name: "Bu sayfada" });
    expect(within(contents).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "#kisaca",
      "#plan",
      "#olcum",
      "#tarayici",
      "#silme",
      "#yapay-zeka",
      "#kim-ne-gorur",
      "#iletisim",
    ]);
    for (const link of within(contents).getAllByRole("link")) {
      expect(document.querySelector(link.getAttribute("href")!)).not.toBeNull();
    }
    expect(screen.getByText("Son güncelleme: 7 Kasım 2026")).toHaveAttribute("datetime", PRIVACY_UPDATED);
    expect(screen.getByRole("link", { name: "GitHub'da konu aç" })).toHaveAttribute("href", `${REPO_URL}/issues`);
    // The AI connection is in localStorage with "Bu cihazda hatırla", in sessionStorage without it.
    expect(screen.getAllByText("va.ai.connection", { selector: "code" })).toHaveLength(2);
  });

  it("renders in English", () => {
    render(<PrivacyPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("No accounts, no cookies");
    expect(screen.getByText("Last updated: 7 November 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Who sees what" })).toBeInTheDocument();
  });
});
