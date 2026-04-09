/**
 * Sirve fotos vía Next (`/api/uploads/...`) para que en producción funcionen aunque el proxy
 * no enrute bien `/uploads/*` hacia la app.
 */
export function inventoryUploadImageSrc(fileUrl: string): string {
  if (!fileUrl) return fileUrl;
  if (fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")) return fileUrl;
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return fileUrl;
  if (fileUrl.startsWith("/uploads/")) {
    const tail = fileUrl.slice("/uploads/".length);
    return `/api/uploads/${tail}`;
  }
  return fileUrl;
}
