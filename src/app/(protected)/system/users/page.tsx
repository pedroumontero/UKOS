import { ProtectedPageShell } from "@/app/(protected)/layout";
import { SystemUsersClient } from "@/features/system/users/system-users-client";
import { ACCESS_CATALOG } from "@/lib/access-catalog";
import { getAppContext } from "@/server/app-context";
import { db } from "@/server/db";
import { getEffectiveAccessSet, requireAccess } from "@/server/tenant-authorization";

export default async function SystemUsersPage() {
  await requireAccess("tenant.users.view");
  const { company, session } = await getAppContext();

  const access = await getEffectiveAccessSet(session.user.id, company.id, session.user.role);
  const canCreate = access.has("tenant.users.create");
  const canEdit = access.has("tenant.users.edit");

  const [memberships, tenantRoles, overrides] = await Promise.all([
    db.companyMembership.findMany({
      where: { companyId: company.id },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        companyRole: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.companyRole.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.companyUserAccessOverride.findMany({
      where: { companyId: company.id },
      orderBy: { accessKey: "asc" },
    }),
  ]);

  const overridesByUserId: Record<string, { id: string; accessKey: string; effect: "ALLOW" | "DENY" }[]> = {};
  for (const o of overrides) {
    if (!overridesByUserId[o.userId]) {
      overridesByUserId[o.userId] = [];
    }
    overridesByUserId[o.userId].push({
      id: o.id,
      accessKey: o.accessKey,
      effect: o.effect,
    });
  }

  const accessOptions = ACCESS_CATALOG.map((e) => ({ key: e.key, label: e.label }));

  return (
    <ProtectedPageShell
      companyName={company.name}
      title="Usuarios"
      description="Administra los usuarios de esta empresa, su rol y excepciones de acceso puntuales."
      moduleLabel="Sistema"
    >
      <SystemUsersClient
        memberships={memberships.map((m) => ({
          id: m.id,
          userId: m.user.id,
          user: m.user,
          companyRole: m.companyRole,
        }))}
        tenantRoles={tenantRoles}
        canCreate={canCreate}
        canEdit={canEdit}
        overridesByUserId={overridesByUserId}
        accessOptions={accessOptions}
      />
    </ProtectedPageShell>
  );
}
