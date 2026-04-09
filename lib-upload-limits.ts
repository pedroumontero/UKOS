/**
 * Límites compartidos: usados por `next.config.ts` (runtime en `next start` sin carpeta `src/`)
 * y por el código de inventario. Mantener una sola fuente de verdad.
 */

export const INVENTORY_SERVER_ACTION_BODY_SIZE_MB = 90;

export const INVENTORY_PHOTOS_MAX_TOTAL_BYTES = 80 * 1024 * 1024;

export const INVENTORY_PHOTOS_MAX_FILE_BYTES = 25 * 1024 * 1024;
