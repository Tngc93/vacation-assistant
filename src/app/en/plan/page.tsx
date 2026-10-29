import { PlanPage, planMetadata } from "../../_shell/PlanPage";

export function generateMetadata({ searchParams }: PageProps<"/en/plan">) {
  return planMetadata({ searchParams, locale: "en" });
}

export default function Page({ searchParams }: PageProps<"/en/plan">) {
  return <PlanPage searchParams={searchParams} locale="en" />;
}
