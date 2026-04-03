/**
 * Migra CompanyRolePermission de claves legacy (system.*, module.*) al catalogo de accesos.
 * Idempotente si ya solo hay claves nuevas (expansion vacia para desconocidas -> se ignoran).
 */
import { PrismaClient } from "@prisma/client";

import { ALL_ACCESS_KEYS, isAccessKey } from "../src/lib/access-catalog";

const prisma = new PrismaClient();

const MF_FULL = ALL_ACCESS_KEYS.filter((k) => k.startsWith("market_flow.") || k === "general.dashboard.view");

const MF_OPERADOR = [
  "general.dashboard.view",
  "market_flow.section.view",
  "market_flow.dashboard.view",
  "market_flow.inventory.view",
  "market_flow.publish.view",
  "market_flow.leads.view",
] as const;

const EXPANSIONS: Record<string, string[]> = {
  "system.access": [
    "tenant.system.nav.view",
    "tenant.users.view",
    "tenant.users.create",
    "tenant.users.edit",
    "tenant.roles.view",
    "tenant.roles.create",
    "tenant.roles.edit",
    "tenant.access.catalog_view",
  ],
  "system.users.read": ["tenant.users.view"],
  "system.users.manage": ["tenant.users.view", "tenant.users.create", "tenant.users.edit"],
  "system.roles.read": ["tenant.roles.view"],
  "system.roles.manage": ["tenant.roles.view", "tenant.roles.create", "tenant.roles.edit"],
  "system.permissions.read": ["tenant.access.catalog_view"],
  "system.modules.read": [],
  "system.modules.manage": [],
  "module.market_flow.access": [...MF_FULL],
};

function expandOldKey(key: string): string[] {
  if (EXPANSIONS[key]) {
    return EXPANSIONS[key];
  }
  if (isAccessKey(key)) {
    return [key];
  }
  return [];
}

async function main() {
  const rows = await prisma.companyRolePermission.findMany({
    include: { companyRole: true },
  });

  const byRole = new Map<string, { slug: string; keys: Set<string> }>();

  for (const row of rows) {
    const roleId = row.companyRoleId;
    if (!byRole.has(roleId)) {
      byRole.set(roleId, { slug: row.companyRole.slug, keys: new Set() });
    }
    for (const k of expandOldKey(row.permissionKey)) {
      if (isAccessKey(k)) {
        byRole.get(roleId)!.keys.add(k);
      }
    }
  }

  for (const [roleId, { slug, keys }] of byRole) {
    let finalKeys: string[];

    if (slug === "operador") {
      finalKeys = [...MF_OPERADOR];
    } else if (slug === "administrador") {
      finalKeys = [...ALL_ACCESS_KEYS];
    } else {
      finalKeys = [...keys];
    }

    const unique = [...new Set(finalKeys)].filter((k) => isAccessKey(k));

    await prisma.companyRolePermission.deleteMany({ where: { companyRoleId: roleId } });
    for (const permissionKey of unique) {
      await prisma.companyRolePermission.create({
        data: { companyRoleId: roleId, permissionKey },
      });
    }
  }

  const processed = new Set(byRole.keys());
  const allRoles = await prisma.companyRole.findMany();
  for (const r of allRoles) {
    if (processed.has(r.id)) {
      continue;
    }
    const finalKeys =
      r.slug === "operador"
        ? [...MF_OPERADOR]
        : r.slug === "administrador"
          ? [...ALL_ACCESS_KEYS]
          : ["tenant.users.view"];
    const unique = [...new Set(finalKeys)].filter((k) => isAccessKey(k));
    await prisma.companyRolePermission.deleteMany({ where: { companyRoleId: r.id } });
    for (const permissionKey of unique) {
      await prisma.companyRolePermission.create({
        data: { companyRoleId: r.id, permissionKey },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        rolesUpdated: byRole.size,
        orphanRolesSynced: allRoles.filter((r) => !processed.has(r.id)).length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
