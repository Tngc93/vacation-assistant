import Image from "next/image";
import type { StoredPhoto } from "@/lib/places/file";

/**
 * Wikimedia Commons photo in duotone, a short wide strip (16:7), with the mandatory author and licence credit.
 * Served from the Commons CDN; preloaded, as it is the plan's largest paint.
 */
export function CityPhoto({ photo, cityName }: { photo: StoredPhoto; cityName: string }) {
  return (
    <figure className="min-w-0">
      <div className="duotone aspect-[16/7] overflow-hidden rounded-md">
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={`${cityName} fotoğrafı`}
          sizes="(min-width: 768px) 40vw, 100vw"
          preload
          // Commons already serves a sized thumbnail; skip paid image optimisation.
          unoptimized
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
