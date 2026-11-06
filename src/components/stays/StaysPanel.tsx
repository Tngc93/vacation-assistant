"use client";

import { useState, type ReactNode } from "react";
import { useAiConnection } from "@/components/ai/useAiConnection";
import { DisclosureToggle } from "@/components/plan/DisclosureToggle";
import { useI18n } from "@/i18n/client";

type Props = {
  /** "Kişi". */
  controls: ReactNode;
  /** The stay links. */
  links: ReactNode;
  /** The stay web search (renders nothing without AI). */
  web: ReactNode;
  /** VA_AI_MOCK: the web search is there without a key. */
  demo: boolean;
};

/** "Konaklama": the number of people on top, the Booking and Google Hotels links, then "Web'de ara" with an AI connection. */
export function StaysPanel({ controls, links, web, demo }: Props) {
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const connected = useAiConnection() !== null || demo;
  return (
    <div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">{controls}</div>
      {/* Straight in the section card: no second frame (DESIGN.md "Plan background", section cards). */}
      <div className="mt-6">{links}</div>
      {connected ? (
        <DisclosureToggle open={open} controls="konaklama-web" onClick={() => setOpen((o) => !o)}>
          {m.stays.webSearch}
        </DisclosureToggle>
      ) : null}
      <div id="konaklama-web" hidden={!open || !connected} className="mt-8">
        <h3 className="mb-4 font-display text-heading">{m.stays.webTitle}</h3>
        {web}
      </div>
    </div>
  );
}
