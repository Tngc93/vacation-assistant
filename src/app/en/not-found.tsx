import { NotFound, notFoundMetadata } from "../_shell/NotFound";

export const metadata = notFoundMetadata("en");

export default function NotFoundPage() {
  return <NotFound locale="en" />;
}
