"use client";

import * as React from "react";

import { inventoryUploadImageSrc } from "@/lib/inventory-upload-public-url";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Miniatura 4:3 + object-cover. Rutas `/uploads/*` se sirven vía `/api/uploads/*` para producción detrás de proxy.
 */
export function InventoryMediaThumbnail({ src, alt, className }: Props) {
  const [broken, setBroken] = React.useState(false);
  const resolved = inventoryUploadImageSrc(src);

  React.useEffect(() => {
    setBroken(false);
  }, [src]);

  if (!src || broken) {
    return (
      <div
        className={cn(
          "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-muted px-2 text-center text-xs text-muted-foreground ring-1 ring-border/40",
          className,
        )}
      >
        Sin vista previa
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border/40",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rutas locales /uploads y blob: */}
      <img
        src={resolved}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    </div>
  );
}
