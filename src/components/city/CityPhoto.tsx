import Image from "next/image";
import { Skeleton } from "@/components/ui";
import { getCityPhoto } from "@/lib/city/cache";
import type { CityPhoto as Photo } from "@/lib/city/photo";

async function loadPhoto(wikidataId: string): Promise<Photo | null> {
  try {
    return await getCityPhoto(wikidataId);
  } catch {
    // No photo is better than a broken page; the masthead stands on its own.
    return null;
  }
}

/** Wikimedia Commons photo in duotone, with the mandatory author and licence credit. */
export async function CityPhoto({ wikidataId, cityName }: { wikidataId: string; cityName: string }) {
  const photo = await loadPhoto(wikidataId);
  if (!photo) return null;
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

export function CityPhotoFallback() {
  return <Skeleton className="aspect-[4/3] w-full rounded-md" />;
}
