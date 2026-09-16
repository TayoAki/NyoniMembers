"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ItemImageProps = {
  /** Signed storage URL, or null/undefined while extracting or missing. */
  src: string | null | undefined;
  alt: string;
  /** Cutouts sit on a soft muted card; renders and photos use "photo". */
  variant?: "cutout" | "photo";
  aspect?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
};

/**
 * The one way to show a garment cutout, avatar or render. Handles the loading shimmer,
 * missing images and object-fit so every tile in the app looks the same.
 */
export function ItemImage({
  src,
  alt,
  variant = "cutout",
  aspect = "aspect-[3/4]",
  className,
  imgClassName,
  priority,
}: ItemImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        variant === "cutout" ? "bg-muted/60 dark:bg-muted/40 p-3" : "bg-muted",
        aspect,
        className,
      )}
    >
      {!loaded || !showImage ? <Skeleton className="absolute inset-0 rounded-xl" /> : null}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage URLs are signed and short-lived; next/image would re-fetch on every render
        <img
          src={src ?? undefined}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "relative size-full transition-opacity duration-300",
            variant === "cutout" ? "object-contain drop-shadow-sm" : "object-cover",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      ) : null}
      {!src && !failed ? null : failed ? (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center">
          <ImageOff className="size-5" aria-hidden />
          <span className="sr-only">Image unavailable</span>
        </div>
      ) : null}
    </div>
  );
}
