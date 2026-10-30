import { PlanPage, planMetadata } from "../../_shell/PlanPage";

export function generateMetadata({ searchParams }: PageProps<"/plan">) {
  return planMetadata({ searchParams, locale: "tr" });
}

export default function Page({ searchParams }: PageProps<"/plan">) {
  return <PlanPage searchParams={searchParams} locale="tr" />;
}
