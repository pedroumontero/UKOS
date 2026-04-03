"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";

import { isAccessKey } from "@/lib/access-catalog";
import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";

function mapTenantSlugToLegacyRole(slug: string): UserRole {
  return slug === "operador" ? UserRole.OPERATOR : UserRole.ADMIN;
}

export async function createCompanyUserAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAccess("tenant.users.create");
  const companyId = session.user.activeCompanyId;

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const companyRoleId = String(formData.get("companyRoleId") || "").trim();

  if (!name || !email || !password || !companyRoleId) {
    return { ok: false, error: "Completa nombre, correo, contrasena y rol." };
  }

  if (password.length < 8) {
    return { ok: false, error: "La contrasena debe tener al menos 8 caracteres." };
  }

  const tenantRole = await db.companyRole.findFirst({
    where: { id: companyRoleId, companyId },
  });

  if (!tenantRole) {
    return { ok: false, error: "El rol seleccionado no pertenece a esta empresa." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      error: "Ese correo ya esta registrado. Cada usuario solo puede existir una vez en UKOS.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const legacyRole = mapTenantSlugToLegacyRole(tenantRole.slug);

  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: legacyRole,
          activeCompanyId: companyId,
        },
      });

      await tx.companyMembership.create({
        data: {
          userId: user.id,
          companyId,
          companyRoleId: tenantRole.id,
        },
      });
    });
  } catch {
    return { ok: false, error: "No se pudo crear el usuario. Intenta de nuevo." };
  }

  revalidatePath("/system/users");
  return { ok: true };
}

export async function updateUserCompanyRoleAction(
  membershipId: string,
  companyRoleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAccess("tenant.users.edit");
  const companyId = session.user.activeCompanyId;

  const membership = await db.companyMembership.findFirst({
    where: { id: membershipId, companyId },
  });
  if (!membership) {
    return { ok: false, error: "Membresia no encontrada." };
  }

  const tenantRole = await db.companyRole.findFirst({
    where: { id: companyRoleId, companyId },
  });
  if (!tenantRole) {
    return { ok: false, error: "Rol invalido para esta empresa." };
  }

  const legacyRole = mapTenantSlugToLegacyRole(tenantRole.slug);

  await db.$transaction(async (tx) => {
    await tx.companyMembership.update({
      where: { id: membershipId },
      data: { companyRoleId: tenantRole.id },
    });
    await tx.user.update({
      where: { id: membership.userId },
      data: { role: legacyRole },
    });
  });

  revalidatePath("/system/users");
  return { ok: true };
}

export async function upsertUserAccessOverrideAction(
  userId: string,
  accessKey: string,
  effect: "ALLOW" | "DENY",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAccess("tenant.users.edit");
  const companyId = session.user.activeCompanyId;

  if (!isAccessKey(accessKey)) {
    return { ok: false, error: "Acceso no valido." };
  }

  const member = await db.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!member) {
    return { ok: false, error: "El usuario no pertenece a esta empresa." };
  }

  await db.companyUserAccessOverride.upsert({
    where: {
      userId_companyId_accessKey: { userId, companyId, accessKey },
    },
    create: { userId, companyId, accessKey, effect },
    update: { effect },
  });

  revalidatePath("/system/users");
  return { ok: true };
}

export async function removeUserAccessOverrideAction(
  overrideId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAccess("tenant.users.edit");
  const companyId = session.user.activeCompanyId;

  const row = await db.companyUserAccessOverride.findFirst({
    where: { id: overrideId, companyId },
  });
  if (!row) {
    return { ok: false, error: "Excepcion no encontrada." };
  }

  await db.companyUserAccessOverride.delete({ where: { id: overrideId } });
  revalidatePath("/system/users");
  return { ok: true };
}
