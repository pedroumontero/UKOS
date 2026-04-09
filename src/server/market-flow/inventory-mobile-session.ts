import { randomBytes } from "node:crypto";

import { db } from "@/server/db";

/** Duración del enlace móvil (no adivinable; expira solo). */
export const INVENTORY_MOBILE_UPLOAD_TTL_MS = 60 * 60 * 1000;

export function createMobileUploadToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function revokeOpenMobileSessionsForUnit(unitId: string, userId: string) {
  const now = new Date();
  await db.inventoryMobileUploadSession.updateMany({
    where: {
      unitId,
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { revokedAt: now },
  });
}

export type ValidMobileSession = {
  id: string;
  unitId: string;
  companyId: string;
  userId: string;
  expiresAt: Date;
};

export async function getValidMobileUploadSessionByToken(token: string): Promise<ValidMobileSession | null> {
  const row = await db.inventoryMobileUploadSession.findUnique({
    where: { token },
    select: {
      id: true,
      unitId: true,
      companyId: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!row || row.revokedAt) {
    return null;
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    id: row.id,
    unitId: row.unitId,
    companyId: row.companyId,
    userId: row.userId,
    expiresAt: row.expiresAt,
  };
}
