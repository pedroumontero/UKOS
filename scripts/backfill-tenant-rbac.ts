/**
 * Crea roles de tenant por empresa y membresias para usuarios existentes.
 * No borra datos de negocio (inventario, leads, etc.). Idempotente.
 */
import { PrismaClient, UserRole } from "@prisma/client";

import {
  ALL_ACCESS_KEYS,
  DEFAULT_OPERATOR_MARKET_FLOW_KEYS,
  type AccessKey,
} from "../src/lib/access-catalog";

const prisma = new PrismaClient();

const OPERATOR_PERMISSIONS: AccessKey[] = [
  "general.dashboard.view",
  ...DEFAULT_OPERATOR_MARKET_FLOW_KEYS,
];

async function ensureRolePermissions(roleId: string, keys: AccessKey[]) {
  await prisma.companyRolePermission.deleteMany({ where: { companyRoleId: roleId } });
  for (const permissionKey of keys) {
    await prisma.companyRolePermission.create({
      data: { companyRoleId: roleId, permissionKey },
    });
  }
}

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, slug: true, name: true } });

  for (const c of companies) {
    const adminRole = await prisma.companyRole.upsert({
      where: { companyId_slug: { companyId: c.id, slug: "administrador" } },
      create: {
        companyId: c.id,
        name: "Administrador",
        slug: "administrador",
        isSystem: true,
        description: "Acceso completo al tenant y configuracion del sistema",
      },
      update: { name: "Administrador", isSystem: true },
    });

    const operatorRole = await prisma.companyRole.upsert({
      where: { companyId_slug: { companyId: c.id, slug: "operador" } },
      create: {
        companyId: c.id,
        name: "Operador",
        slug: "operador",
        isSystem: true,
        description: "Solo operacion Market Flow",
      },
      update: { name: "Operador", isSystem: true },
    });

    await ensureRolePermissions(adminRole.id, ALL_ACCESS_KEYS);
    await ensureRolePermissions(operatorRole.id, OPERATOR_PERMISSIONS);
  }

  const users = await prisma.user.findMany();
  for (const u of users) {
    const targetSlug = u.role === UserRole.OPERATOR ? "operador" : "administrador";
    const role = await prisma.companyRole.findUnique({
      where: {
        companyId_slug: { companyId: u.activeCompanyId, slug: targetSlug },
      },
    });
    if (!role) continue;

    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: { userId: u.id, companyId: u.activeCompanyId },
      },
      create: {
        userId: u.id,
        companyId: u.activeCompanyId,
        companyRoleId: role.id,
      },
      update: { companyRoleId: role.id },
    });
  }

  console.log(
    JSON.stringify(
      {
        companies: companies.length,
        usersSynced: users.length,
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
