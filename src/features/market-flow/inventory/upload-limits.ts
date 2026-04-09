/**
 * Validación de fotos en inventario (cliente + Server Actions).
 * Constantes numéricas: raíz `lib-upload-limits.ts` (también usado por `next.config.ts` en prod).
 */

import {
  INVENTORY_PHOTOS_MAX_FILE_BYTES,
  INVENTORY_PHOTOS_MAX_TOTAL_BYTES,
  INVENTORY_SERVER_ACTION_BODY_SIZE_MB,
} from "../../../../lib-upload-limits";

export {
  INVENTORY_PHOTOS_MAX_FILE_BYTES,
  INVENTORY_PHOTOS_MAX_TOTAL_BYTES,
  INVENTORY_SERVER_ACTION_BODY_SIZE_MB,
};

export const INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE =
  "Las fotos superan el límite permitido. Reduce la cantidad o el peso total antes de guardar.";

export function validateInventoryPhotoPayload(files: File[]): string | null {
  if (!files.length) return null;
  if (files.some((f) => f.size > INVENTORY_PHOTOS_MAX_FILE_BYTES)) {
    return INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE;
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > INVENTORY_PHOTOS_MAX_TOTAL_BYTES) {
    return INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE;
  }
  return null;
}

/** Tras optimizar en servidor (sharp), validar tamaños finales antes de escribir disco. */
export function validateInventoryOptimizedBuffers(buffers: Buffer[]): string | null {
  if (!buffers.length) return null;
  if (buffers.some((b) => b.length > INVENTORY_PHOTOS_MAX_FILE_BYTES)) {
    return INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE;
  }
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  if (total > INVENTORY_PHOTOS_MAX_TOTAL_BYTES) {
    return INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE;
  }
  return null;
}
