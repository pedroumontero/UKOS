"use server";

import { revalidatePath } from "next/cache";

import { isAccessKey } from "@/lib/access-catalog";
import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export async function createCompanyRoleAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAccess("tenant.roles.create");
  const companyId = session.user.activeCompanyId;
  const name = String(formData.get("name") || "").trim();
  if (!name) {
    return { ok: false, error: "Indica el nombre del rol." };
  }

  const base = slugify(name);
  let slug = base || "rol";
  let suffix = 0;
  while (await db.companyRole.findFirst({ where: { companyId, slug } })) {
    suffix += 1;
    slug = `${base || "rol"}-${suffix}`;
  }

  await db.companyRole.create({
    data: {
      companyId,
      name,
      slug,
      isSystem: false,
      description: null,
    },
  });

  revalidatePath("/system/roles");
  return { ok: true };
}

export async function updateCompanyRoleAccessAction(
  roleId: string,
  accessKeys: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAccess("tenant.roles.edit");
  const companyId = session.user.activeCompanyId;

  const role = await db.companyRole.findFirst({
    where: { id: roleId, companyId },
  });
  if (!role) {
    return { ok: false, error: "Rol no encontrado en esta empresa." };
  }

  const keys = [...new Set(accessKeys)].filter((k) => isAccessKey(k));

  await db.$transaction(async (tx) => {
    await tx.companyRolePermission.deleteMany({ where: { companyRoleId: roleId } });
    for (const permissionKey of keys) {
      await tx.companyRolePermission.create({
        data: { companyRoleId: roleId, permissionKey },
      });
    }
  });

  revalidatePath("/system/roles");
  revalidatePath(`/system/roles/${roleId}`);
  return { ok: true };
}
