/**
 * Reduce peso en el móvil antes del POST (canvas JPEG) para evitar timeouts y 413.
 * HEIC/PNG raros: si falla createImageBitmap, se devuelve el archivo original (el servidor usa sharp).
 */
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;

export async function prepareImageFileForMobileUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size === 0) {
    return file;
  }
  // HEIC suele no decodificarse en canvas del navegador; el servidor lo maneja.
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const maxDim = Math.max(bitmap.width, bitmap.height);
      const scale = maxDim > MAX_EDGE ? MAX_EDGE / maxDim : 1;
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      if (scale >= 1 && file.size < 1.5 * 1024 * 1024) {
        return file;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return file;
      }
      ctx.drawImage(bitmap, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
      });
      if (!blob || blob.size === 0) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
