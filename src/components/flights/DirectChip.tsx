"use client";

import { Plane } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Chip } from "@/components/ui";

/** "Aktarmasız" filter; writes ?direct=1 so the server asks the API for non-stop tickets only. */
export function DirectChip({ selected }: { selected: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toggle = () => {
    const params = new URLSearchParams(window.location.search);
    if (selected) params.delete("direct");
    else params.set("direct", "1");
    startTransition(() => router.replace(`/plan?${params.toString()}#ucuslar`, { scroll: false }));
  };
  return (
    <Chip selected={selected} onClick={toggle} aria-busy={pending} icon={<Plane size={16} strokeWidth={1.5} />}>
      Aktarmasız
    </Chip>
  );
}
