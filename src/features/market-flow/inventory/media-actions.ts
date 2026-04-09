"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";

import { requireSession } from "@/server/auth";
import { db } from "@/server/db";
import { canWriteInventoryUnit } from "@/server/inventory-permissions";

async function assertWritableUnit(companyId: string, unitId: string) {
  const session = await requireSession();
  if (session.user.activeCompanyId !== companyId) {
    return { unit: null, error: "Empresa no coincide." };
  }

  const unit = await db.productUnit.findFirst({
    where: { id: unitId, companyId },
    include: { media: true },
  });

  if (!unit) {
    return { unit: null, error: "Unidad no encontrada." };
  }

  if (!(await canWriteInventoryUnit(session.user, unit))) {
    return { unit: null, error: "No tienes permiso para modificar las fotos de esta unidad." };
  }

  return { unit, error: null as string | null };
}

async function removeFileFromDisk(fileUrl: string) {
  const relative = fileUrl.replace(/^\//, "");
  const fullPath = path.join(process.cwd(), "public", relative);

  try {
    await unlink(fullPath);
  } catch {
    // archivo ya borrado o ruta invalida
  }
}

export async function deleteProductMediaAction(formData: FormData) {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;
  const mediaId = String(formData.get("mediaId") || "");
  const unitId = String(formData.get("unitId") || "");

  if (!mediaId || !unitId) {
    return { ok: false, error: "Datos incompletos." };
  }

  const { unit, error: unitError } = await assertWritableUnit(companyId, unitId);
  if (!unit || unitError) {
    return { ok: false, error: unitError ?? "Unidad no encontrada." };
  }

  const media = unit.media.find((item) => item.id === mediaId);

  if (!media) {
    return { ok: false, error: "Foto no encontrada." };
  }

  await removeFileFromDisk(media.fileUrl);

  await db.productMedia.delete({
    where: { id: mediaId },
  });

  const remaining = await db.productMedia.findMany({
    where: { unitId },
    orderBy: { sortOrder: "asc" },
  });

  if (remaining.length && !remaining.some((item) => item.isPrimary)) {
    await db.productMedia.update({
      where: { id: remaining[0].id },
      data: { isPrimary: true },
    });
  }

  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/publicar");

  return { ok: true };
}

export async function reorderProductMediaAction(formData: FormData) {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;
  const unitId = String(formData.get("unitId") || "");
  const orderedRaw = String(formData.get("orderedIds") || "").trim();

  if (!unitId || !orderedRaw) {
    return { ok: false, error: "Orden invalido." };
  }

  const { unit, error: unitError } = await assertWritableUnit(companyId, unitId);
  if (!unit || unitError) {
    return { ok: false, error: unitError ?? "Unidad no encontrada." };
  }

  const orderedIds = orderedRaw.split(",").filter(Boolean);
  const validIds = new Set(unit.media.map((m) => m.id));

  if (orderedIds.length !== unit.media.length || orderedIds.some((id) => !validIds.has(id))) {
    return { ok: false, error: "La lista de fotos no coincide con la unidad." };
  }

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.productMedia.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/publicar");

  return { ok: true };
}

export async function setPrimaryProductMediaAction(formData: FormData) {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;
  const unitId = String(formData.get("unitId") || "");
  const mediaId = String(formData.get("mediaId") || "");

  if (!unitId || !mediaId) {
    return { ok: false, error: "Datos incompletos." };
  }

  const { unit, error: unitError } = await assertWritableUnit(companyId, unitId);
  if (!unit || unitError) {
    return { ok: false, error: unitError ?? "Unidad no encontrada." };
  }

  const media = unit.media.find((item) => item.id === mediaId);

  if (!media) {
    return { ok: false, error: "Foto no encontrada." };
  }

  await db.$transaction([
    db.productMedia.updateMany({
      where: { unitId },
      data: { isPrimary: false },
    }),
    db.productMedia.update({
      where: { id: mediaId },
      data: { isPrimary: true },
    }),
  ]);

  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/publicar");

  return { ok: true };
}
