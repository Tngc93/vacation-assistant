import { RootDocument, rootMetadata } from "../_shell/RootDocument";

export { viewport } from "../_shell/RootDocument";
export const metadata = rootMetadata("tr");

/** Turkish, the default language, at the root: /, /plan. */
export default function TurkishLayout({ children }: LayoutProps<"/">) {
  return <RootDocument locale="tr">{children}</RootDocument>;
}
