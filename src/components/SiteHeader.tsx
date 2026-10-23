import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BRAND_NAME } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="border-b border-rule print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="font-display text-heading tracking-tight text-ink no-underline">
          {BRAND_NAME}
        </Link>
        <nav aria-label="Ana menü" className="flex items-center gap-4">
          {/* A tool for us, not for travellers: the page stays reachable (noindex) but isn't linked in production. */}
          {process.env.NODE_ENV === "development" ? (
            <Link
              href="/styleguide"
              className="hidden font-mono text-micro uppercase tracking-[0.08em] text-ink-muted hover:text-ink sm:inline"
            >
              Stil rehberi
            </Link>
          ) : null}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
