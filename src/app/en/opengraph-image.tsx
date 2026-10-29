import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/size";
import { brandOgCard, homeOgAlt } from "../_shell/homeOgImage";

export const alt = homeOgAlt("en");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return brandOgCard("en");
}
