import { revalidatePath } from "next/cache";

import {
  INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE,
  validateInventoryPhotoPayload,
} from "@/features/market-flow/inventory/upload-limits";
import { db } from "@/server/db";
import { saveProductPhotos } from "@/server/market-flow/uploads";

export type MobileUploadPersistResult =
  | { ok: true; added: number }
  | { ok: false; error: string; status: number };

export async function persistInventoryPhotosFromMobileUpload(params: {
  companyId: string;
  unitId: string;
  actorUserId: string;
  files: File[];
}): Promise<MobileUploadPersistResult> {
  const { companyId, unitId, actorUserId, files } = params;

  const nonEmpty = files.filter((f) => f instanceof File && f.size > 0);
  if (!nonEmpty.length) {
    return { ok: false, error: "No se recibieron archivos.", status: 400 };
  }

  const limitError = validateInventoryPhotoPayload(nonEmpty);
  if (limitError) {
    return { ok: false, error: limitError, status: 400 };
  }

  const unit = await db.productUnit.findFirst({
    where: { id: unitId, companyId },
    include: { media: true },
  });

  if (!unit) {
    return { ok: false, error: "Unidad no encontrada.", status: 404 };
  }

  let saved: Array<{ fileUrl: string; fileName: string }>;
  try {
    saved = await saveProductPhotos(companyId, nonEmpty);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE) {
      return { ok: false, error: message, status: 400 };
    }
    if (/Body exceeded|413|body.*limit/i.test(message)) {
      return {
        ok: false,
        error: INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE,
        status: 413,
      };
    }
    console.error("[persistInventoryPhotosFromMobileUpload]", e);
    return { ok: false, error: "No se pudieron guardar las fotos.", status: 500 };
  }

  if (!saved.length) {
    return { ok: false, error: "No se pudieron procesar las imágenes.", status: 400 };
  }

  const baseOrder = unit.media.length;
  const hasPrimary = unit.media.some((m) => m.isPrimary);

  await db.$transaction(async (tx) => {
    for (let i = 0; i < saved.length; i += 1) {
      const photo = saved[i]!;
      const sortOrder = baseOrder + i;
      const isPrimary = !hasPrimary && i === 0;
      await tx.productMedia.create({
        data: {
          unitId,
          fileUrl: photo.fileUrl,
          fileName: photo.fileName,
          sortOrder,
          isPrimary,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        companyId,
        actorUserId,
        entityType: "product_unit",
        entityId: unitId,
        activityType: "updated",
        label: `${saved.length} foto(s) subidas desde enlace móvil`,
      },
    });
  });

  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/dashboard");
  revalidatePath("/market-flow/publicar");

  return { ok: true, added: saved.length };
}
