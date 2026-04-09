"use server";

import { revalidatePath } from "next/cache";

import type { InventoryUnit } from "@/features/market-flow/inventory/types";
import { requireSession } from "@/server/auth";
import { db } from "@/server/db";
import { canWriteInventoryUnit } from "@/server/inventory-permissions";
import { getInventoryUnit } from "@/server/market-flow/inventory";
import { createMinimalDraftProductUnitForMobile } from "@/server/market-flow/inventory-mobile-draft";
import {
  createMobileUploadToken,
  INVENTORY_MOBILE_UPLOAD_TTL_MS,
  revokeOpenMobileSessionsForUnit,
} from "@/server/market-flow/inventory-mobile-session";
import { userHasAccess } from "@/server/tenant-authorization";

export type MobileUploadSessionPayload = {
  token: string;
  sessionId: string;
  expiresAt: string;
  path: string;
};

export async function ensureDraftProductUnitForMobileUploadAction(): Promise<
  { ok: true; unit: InventoryUnit } | { ok: false; error: string }
> {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;
  const canCreate = await userHasAccess(
    session.user.id,
    companyId,
    session.user.role,
    "market_flow.inventory.create",
  );
  if (!canCreate) {
    return { ok: false, error: "No tienes permiso para crear productos en inventario." };
  }

  const row = await createMinimalDraftProductUnitForMobile({
    companyId,
    actorUserId: session.user.id,
  });

  const unit = await getInventoryUnit(companyId, row.id);
  if (!unit) {
    return { ok: false, error: "No se pudo cargar el borrador creado." };
  }

  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/dashboard");
  revalidatePath("/market-flow/publicar");

  return { ok: true, unit };
}

export async function createInventoryMobileUploadSessionAction(
  unitId: string,
): Promise<{ ok: true; data: MobileUploadSessionPayload } | { ok: false; error: string }> {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;

  const unit = await db.productUnit.findFirst({
    where: { id: unitId, companyId },
  });

  if (!unit) {
    return { ok: false, error: "La unidad no pertenece a la empresa activa." };
  }

  const allowed = await canWriteInventoryUnit(session.user, unit);
  if (!allowed) {
    return { ok: false, error: "No tienes permiso para generar un enlace de subida para esta unidad." };
  }

  await revokeOpenMobileSessionsForUnit(unitId, session.user.id);

  const token = createMobileUploadToken();
  const expiresAt = new Date(Date.now() + INVENTORY_MOBILE_UPLOAD_TTL_MS);

  const row = await db.inventoryMobileUploadSession.create({
    data: {
      token,
      unitId,
      companyId,
      userId: session.user.id,
      expiresAt,
    },
  });

  return {
    ok: true,
    data: {
      token,
      sessionId: row.id,
      expiresAt: expiresAt.toISOString(),
      path: `/mobile-upload/${token}`,
    },
  };
}

export async function revokeInventoryMobileUploadSessionAction(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;

  const updated = await db.inventoryMobileUploadSession.updateMany({
    where: {
      id: sessionId,
      userId: session.user.id,
      companyId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  if (updated.count === 0) {
    return { ok: false, error: "Sesión no encontrada o ya cerrada." };
  }

  return { ok: true };
}

export async function getInventoryUnitMediaSnapshotAction(
  unitId: string,
): Promise<
  | {
      ok: true;
      media: InventoryUnit["media"];
    }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;

  const canView = await userHasAccess(
    session.user.id,
    companyId,
    session.user.role,
    "market_flow.inventory.view",
  );
  if (!canView) {
    return { ok: false, error: "Sin acceso a inventario." };
  }

  const unit = await db.productUnit.findFirst({
    where: { id: unitId, companyId },
    select: {
      id: true,
      media: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          sortOrder: true,
          isPrimary: true,
        },
      },
    },
  });

  if (!unit) {
    return { ok: false, error: "Unidad no encontrada." };
  }

  return {
    ok: true,
    media: unit.media.map((m) => ({
      id: m.id,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      sortOrder: m.sortOrder,
      isPrimary: m.isPrimary,
    })),
  };
}
