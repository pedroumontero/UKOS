import { ProtectedPageShell } from "@/app/(protected)/layout";
import { SystemRolesClient } from "@/features/system/roles/system-roles-client";
import { getAppContext } from "@/server/app-context";
import { db } from "@/server/db";
import { getEffectiveAccessSet, requireAccess } from "@/server/tenant-authorization";

export default async function SystemRolesPage() {
  await requireAccess("tenant.roles.view");
  const { company, session } = await getAppContext();
  const access = await getEffectiveAccessSet(session.user.id, company.id, session.user.role);

  const roles = await db.companyRole.findMany({
    where: { companyId: company.id },
    include: {
      _count: { select: { permissions: true, memberships: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <ProtectedPageShell
      companyName={company.name}
      title="Roles"
      description="Perfiles de acceso de tu empresa. Cada rol define que puede ver y hacer cada usuario (dentro de los modulos contratados)."
      moduleLabel="Sistema"
    >
      <SystemRolesClient
        roles={roles.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          isSystem: r.isSystem,
          permCount: r._count.permissions,
          userCount: r._count.memberships,
        }))}
        canCreate={access.has("tenant.roles.create")}
        canEdit={access.has("tenant.roles.edit")}
      />
    </ProtectedPageShell>
  );
}
