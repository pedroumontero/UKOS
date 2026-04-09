import sharp from "sharp";

/** Lado máximo (px) tras resize; encaja en 1600–2000 px pedidos. */
export const INVENTORY_IMAGE_MAX_EDGE = 1920;

export const INVENTORY_JPEG_QUALITY = 82;
export const INVENTORY_WEBP_QUALITY = 82;

export type OptimizedImageResult = {
  buffer: Buffer;
  extension: "jpg" | "webp";
};

/**
 * Rota según EXIF, limita resolución, comprime.
 * Salida JPEG (fotos sin transparencia) o WebP (alpha). HEIC/PNG/JPEG vía libvips.
 * Si sharp falla, devuelve null y el caller guarda el original.
 */
export async function optimizeInventoryImage(buffer: Buffer): Promise<OptimizedImageResult | null> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    const hasAlpha = meta.hasAlpha === true;

    const pipeline = sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: INVENTORY_IMAGE_MAX_EDGE,
        height: INVENTORY_IMAGE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });

    if (hasAlpha) {
      const out = await pipeline.webp({ quality: INVENTORY_WEBP_QUALITY, effort: 4 }).toBuffer();
      return { buffer: out, extension: "webp" };
    }

    const out = await pipeline
      .jpeg({
        quality: INVENTORY_JPEG_QUALITY,
        mozjpeg: true,
        chromaSubsampling: "4:4:4",
      })
      .toBuffer();

    return { buffer: out, extension: "jpg" };
  } catch (e) {
    console.warn("[optimizeInventoryImage] sharp failed, se usará archivo original si cabe en límites", e);
    return null;
  }
}
