import { RootDocument, rootMetadata } from "../_shell/RootDocument";

export { viewport } from "../_shell/RootDocument";
export const metadata = rootMetadata("en");

/** English, under /en: /en, /en/plan. */
export default function EnglishLayout({ children }: LayoutProps<"/en">) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
