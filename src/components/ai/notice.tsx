import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { I18n } from "@/i18n/i18n";
import { aiErrorCaption, aiErrorText } from "@/lib/ai/errors";

export type Notice = { tone: "ink" | "warn"; text: string; detail?: string | null };

/** The calm message, in the interface language, and under it only the HTTP status and model name. */
export function errorNotice(error: unknown, i18n: Pick<I18n, "m" | "f">): Notice {
  return { tone: "warn", text: aiErrorText(error, i18n), detail: aiErrorCaption(error) };
}

export function NoticeText({ notice, alert }: { notice: Notice; alert?: boolean }) {
  return (
    <div role={alert ? "alert" : undefined} className="grid gap-1">
      <p className={cn("text-caption", notice.tone === "warn" ? "text-warn" : "text-ink")}>{notice.text}</p>
      {notice.detail ? <Caption>{notice.detail}</Caption> : null}
    </div>
  );
}
