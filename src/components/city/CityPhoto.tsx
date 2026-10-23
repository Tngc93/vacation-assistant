import { preload } from "react-dom";
import type { StoredPhoto } from "@/lib/places/file";

/** Commons thumbnail widths it serves (see places/photos.ts); 960 is enough for a phone's full width. */
const WIDTHS = [500, 960, 1280] as const;
const SIZES = "(min-width: 768px) 40vw, 100vw";

/** srcset from the stored thumbnail ("…/1280px-…"), at the standard widths up to its own. */
export function cityPhotoSrcSet(photo: Pick<StoredPhoto, "src" | "width">): string | undefined {
  if (!/\/\d+px-/.test(photo.src)) return undefined;
  return WIDTHS.filter((w) => w <= photo.width)
    .map((w) => `${photo.src.replace(/\/\d+px-/, `/${w}px-`)} ${w}w`)
    .join(", ");
}

/**
 * Wikimedia Commons photo in duotone, a short wide strip (16:7), with the mandatory author and licence credit.
 * Served from the Commons CDN at a standard width for the screen. On wide screens it is the plan's largest
 * paint and is preloaded; on phones the first place card is, so the strip doesn't jump the queue there.
 */
export function CityPhoto({ photo, cityName }: { photo: StoredPhoto; cityName: string }) {
  const srcSet = cityPhotoSrcSet(photo);
  preload(photo.src, {
    as: "image",
    imageSrcSet: srcSet,
    imageSizes: srcSet ? SIZES : undefined,
    fetchPriority: "high",
    crossOrigin: "anonymous",
    media: "(min-width: 768px)",
  });
  return (
    <figure className="min-w-0">
      <div className="duotone aspect-[16/7] overflow-hidden rounded-md">
        {/* Commons serves sized thumbnails itself; next/image optimisation would add nothing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          srcSet={srcSet}
          sizes={srcSet ? SIZES : undefined}
          width={photo.width}
          height={photo.height}
          alt={`${cityName} fotoğrafı`}
          // No credentials: Commons answers with CORS headers, and the browser keeps none of its cookies.
          crossOrigin="anonymous"
          // Low on phones, where the first card is the largest paint; on wide screens the preload above is high.
          fetchPriority="low"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
      <figcaption className="mt-1.5 font-mono text-[0.625rem] leading-snug tracking-[0.02em] text-ink-muted">
        Fotoğraf:{" "}
        <a href={photo.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {photo.author}
        </a>{" "}
        ·{" "}
        <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
          {photo.license}
        </a>{" "}
        · Wikimedia Commons · renkleri düzenlendi
      </figcaption>
    </figure>
  );
}
