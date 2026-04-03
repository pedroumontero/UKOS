"use server";

import { revalidatePath } from "next/cache";
import { ModuleKey, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { requireSession } from "@/server/auth";

async function requireSuperAdminSession() {
  const session = await requireSession();
  if (session.user.role !== UserRole.SUPERADMIN) {
    redirect("/dashboard");
  }
  return session;
}

export async function toggleCompanyModuleFormAction(formData: FormData) {
  await requireSuperAdminSession();
  const companyId = String(formData.get("companyId") || "");
  const moduleKeyRaw = String(formData.get("moduleKey") || "");
  const nextRaw = String(formData.get("nextEnabled") || "");

  if (!companyId || !moduleKeyRaw) {
    return;
  }

  const moduleKey = moduleKeyRaw as ModuleKey;
  if (!Object.values(ModuleKey).includes(moduleKey)) {
    return;
  }

  const isEnabled = nextRaw === "true";

  await db.companyModule.upsert({
    where: {
      companyId_moduleKey: {
        companyId,
        moduleKey,
      },
    },
    update: { isEnabled },
    create: {
      companyId,
      moduleKey,
      isEnabled,
    },
  });

  revalidatePath("/super/company-modules");
}
