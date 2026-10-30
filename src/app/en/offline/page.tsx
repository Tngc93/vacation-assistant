import { OfflinePage, offlineMetadata } from "../../_shell/OfflinePage";

export const metadata = offlineMetadata("en");

export default function Page() {
  return <OfflinePage locale="en" />;
}
