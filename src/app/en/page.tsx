import { HomePage, homeMetadata } from "../_shell/HomePage";

export const metadata = homeMetadata("en");

export default function Page() {
  return <HomePage locale="en" />;
}
