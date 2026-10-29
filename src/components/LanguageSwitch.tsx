"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useI18n } from "@/i18n/client";
import { switchLocaleHref, type Locale } from "@/i18n/locales";

/**
 * The header's TR / EN switch (DESIGN.md "Language switch"): the same page in the other language, with every
 * query parameter kept (the trip, the budget, skipped stops). A plain link, so it works before hydration; the
 * query is read when it is pointed at, focused or clicked, since the budget rewrites it with history.replaceState.
 * There is no automatic redirect by browser language.
 */
export function LanguageSwitch() {
  const { locale, m } = useI18n();
  const pathname = usePathname();
  const target: Locale = locale === "tr" ? "en" : "tr";
  const href = () => switchLocaleHref(target, pathname, window.location.search, window.location.hash);
  const withQuery = (event: { currentTarget: HTMLAnchorElement }) => {
    event.currentTarget.href = href();
  };
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    withQuery(event);
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // A full load: each language has its own root layout.
    event.preventDefault();
    window.location.assign(href());
  };
  return (
    <div role="group" aria-label={m.shell.language} className="inline-flex items-center gap-0.5 font-mono text-micro uppercase tracking-[0.08em]">
      <span aria-current="true" className="px-1 py-1 text-ink sm:px-1.5">
        {locale.toUpperCase()}
      </span>
      <span aria-hidden="true" className="text-ink-muted">
        /
      </span>
      <a
        href={switchLocaleHref(target, pathname)}
        hrefLang={target}
        lang={target}
        onPointerEnter={withQuery}
        onFocus={withQuery}
        onClick={onClick}
        className="inline-flex min-h-8 items-center px-1 text-ink-muted no-underline hover:text-ink sm:px-1.5"
      >
        {target.toUpperCase()}
        <span className="sr-only"> · {m.shell.otherLanguage}</span>
      </a>
    </div>
  );
}
