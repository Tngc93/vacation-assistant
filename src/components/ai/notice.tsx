import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AiError, aiErrorCaption } from "@/lib/ai/errors";

export type Notice = { tone: "ink" | "warn"; text: string; detail?: string | null };

/** The calm message and, under it, only the HTTP status and model name. */
export function errorNotice(error: unknown): Notice {
  return { tone: "warn", text: error instanceof AiError ? error.message : new AiError("network").message, detail: aiErrorCaption(error) };
}

export function NoticeText({ notice, alert }: { notice: Notice; alert?: boolean }) {
  return (
    <div role={alert ? "alert" : undefined} className="grid gap-1">
      <p className={cn("text-caption", notice.tone === "warn" ? "text-warn" : "text-ink")}>{notice.text}</p>
      {notice.detail ? <Caption>{notice.detail}</Caption> : null}
    </div>
  );
}
