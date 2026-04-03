import { notFound } from "next/navigation";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { RoleAccessFormClient } from "@/features/system/roles/role-access-form-client";
import { getAppContext } from "@/server/app-context";
import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";
import { isAccessKey, type AccessKey } from "@/lib/access-catalog";

export default async function SystemRoleEditPage({ params }: { params: Promise<{ roleId: string }> }) {
  await requireAccess("tenant.roles.edit");
  const { roleId } = await params;
  const { company } = await getAppContext();

  const role = await db.companyRole.findFirst({
    where: { id: roleId, companyId: company.id },
    include: { permissions: true },
  });

  if (!role) {
    notFound();
  }

  const initialKeys = role.permissions.map((p) => p.permissionKey).filter((k): k is AccessKey => isAccessKey(k));

  return (
    <ProtectedPageShell
      companyName={company.name}
      title={`Editar rol: ${role.name}`}
      description="Define que pantallas y acciones tendran los usuarios con este rol."
      moduleLabel="Sistema"
    >
      <RoleAccessFormClient roleId={role.id} roleName={role.name} initialKeys={initialKeys} />
    </ProtectedPageShell>
  );
}
