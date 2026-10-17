"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { writeBudgetParams } from "@/lib/budget/params";
import { cn } from "@/lib/cn";

/** Puts a ticket in the budget (?flight=…); the budget recalculates on the server with the same cached prices. */
export function AddToBudgetButton({ flightRef, inBudget, className }: { flightRef: string; inBudget: boolean; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const add = () => {
    if (inBudget) return;
    const params = writeBudgetParams(new URLSearchParams(window.location.search), { flight: flightRef });
    startTransition(() => router.replace(`/plan?${params.toString()}${window.location.hash}`, { scroll: false }));
  };
  return (
    <button
      type="button"
      onClick={add}
      aria-pressed={inBudget}
      aria-busy={pending}
      className={cn(
        "inline-flex items-center gap-1 text-caption underline-offset-4",
        inBudget ? "text-ink" : "text-ink-muted underline hover:text-ink",
        className,
      )}
    >
      {inBudget ? <Check aria-hidden="true" size={14} strokeWidth={1.5} /> : <Plus aria-hidden="true" size={14} strokeWidth={1.5} />}
      {inBudget ? "Bütçede" : "Bütçeye ekle"}
    </button>
  );
}
