/**
 * Asigna todos los accesos del catalogo a cada CompanyRole existente
 * y elimina overrides por usuario (evita DENY que bloquee).
 * Idempotente.
 */
import { PrismaClient } from "@prisma/client";

import { ALL_ACCESS_KEYS } from "../src/lib/access-catalog";

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.companyRole.findMany({
    select: { id: true, companyId: true, name: true, slug: true },
  });

  const deletedOverrides = await prisma.companyUserAccessOverride.deleteMany({});

  for (const role of roles) {
    await prisma.companyRolePermission.deleteMany({ where: { companyRoleId: role.id } });
    await prisma.companyRolePermission.createMany({
      data: ALL_ACCESS_KEYS.map((permissionKey) => ({
        companyRoleId: role.id,
        permissionKey,
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        rolesUpdated: roles.length,
        accessKeysPerRole: ALL_ACCESS_KEYS.length,
        userOverridesRemoved: deletedOverrides.count,
        roles: roles.map((r) => ({ slug: r.slug, name: r.name })),
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
