import { notFound } from "next/navigation";
import { notFoundMetadata } from "../../_shell/NotFound";

export const metadata = notFoundMetadata("en");

/** Every unknown address in this language gets its not-found page inside the site's header and footer. */
export default function UnknownPage(): never {
  notFound();
}
