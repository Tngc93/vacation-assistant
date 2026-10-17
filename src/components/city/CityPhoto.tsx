import Image from "next/image";
import type { StoredPhoto } from "@/lib/places/file";

/** Wikimedia Commons photo in duotone, with the mandatory author and licence credit. Served from the Commons CDN. */
export function CityPhoto({ photo, cityName }: { photo: StoredPhoto; cityName: string }) {
  return (
    <figure className="min-w-0">
      <div className="duotone aspect-[4/3] overflow-hidden rounded-md">
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={`${cityName} fotoğrafı`}
          sizes="(min-width: 768px) 40vw, 100vw"
          // Commons already serves a sized thumbnail; skip paid image optimisation.
          unoptimized
          className="h-full w-full object-cover"
        />
      </div>
      <figcaption className="mt-2 font-mono text-micro tracking-[0.02em] text-ink-muted">
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
