import { NotFound, notFoundMetadata } from "../_shell/NotFound";

export const metadata = notFoundMetadata("tr");

export default function NotFoundPage() {
  return <NotFound locale="tr" />;
}
