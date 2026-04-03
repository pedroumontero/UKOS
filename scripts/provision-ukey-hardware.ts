/**
 * Provisiona empresa Ukey Hardware + usuario inicial. Idempotente.
 * No modifica UKOS Demo (slug ukos-demo) ni ejecuta prisma/seed.ts.
 */
import bcrypt from "bcryptjs";
import { ModuleKey, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const COMPANY_SLUG = "ukey-hardware";
const ADMIN_EMAIL = "ukeysoftwares@gmail.com";
const ADMIN_NAME = "Admin";
const ADMIN_PASSWORD = "Usa2025*..*";

async function main() {
  const demo = await prisma.company.findUnique({ where: { slug: "ukos-demo" } });
  if (!demo) {
    console.warn("Aviso: no existe ukos-demo (entorno sin demo seed).");
  }

  const company = await prisma.company.upsert({
    where: { slug: COMPANY_SLUG },
    update: {
      name: "Ukey Hardware",
      status: "active",
    },
    create: {
      name: "Ukey Hardware",
      slug: COMPANY_SLUG,
      status: "active",
      defaultCurrency: "USD",
      timezone: "America/New_York",
    },
  });

  await prisma.companyModule.upsert({
    where: {
      companyId_moduleKey: { companyId: company.id, moduleKey: ModuleKey.MARKET_FLOW },
    },
    update: { isEnabled: true },
    create: {
      companyId: company.id,
      moduleKey: ModuleKey.MARKET_FLOW,
      isEnabled: true,
    },
  });

  await prisma.companyModuleSettings.upsert({
    where: {
      companyId_moduleKey: { companyId: company.id, moduleKey: ModuleKey.MARKET_FLOW },
    },
    update: {
      industryType: "Tecnologia / Hardware",
      aiToneProfile: "Directo, vendedor y claro.",
      defaultPriceStrategy: "manual",
      settingsJson: {
        integrations: {},
        priceStrategy: {
          type: "reventa",
          marginConfigurable: true,
          marginPercent: null,
        },
      },
    },
    create: {
      companyId: company.id,
      moduleKey: ModuleKey.MARKET_FLOW,
      industryType: "Tecnologia / Hardware",
      aiToneProfile: "Directo, vendedor y claro.",
      defaultPriceStrategy: "manual",
      settingsJson: {
        integrations: {},
        priceStrategy: {
          type: "reventa",
          marginConfigurable: true,
          marginPercent: null,
        },
      },
    },
  });

  const channelSeeds = [
    { code: "facebook_marketplace", displayName: "Facebook Marketplace", sortOrder: 1 },
    { code: "offerup", displayName: "OfferUp", sortOrder: 2 },
    { code: "ebay", displayName: "eBay", sortOrder: 3 },
  ];

  for (const ch of channelSeeds) {
    await prisma.channel.upsert({
      where: {
        companyId_code: { companyId: company.id, code: ch.code },
      },
      update: {
        displayName: ch.displayName,
        sortOrder: ch.sortOrder,
        isEnabled: true,
      },
      create: {
        companyId: company.id,
        code: ch.code,
        displayName: ch.displayName,
        sortOrder: ch.sortOrder,
        isEnabled: true,
      },
    });
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL.toLowerCase() },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: UserRole.ADMIN,
      activeCompanyId: company.id,
    },
    create: {
      email: ADMIN_EMAIL.toLowerCase(),
      name: ADMIN_NAME,
      passwordHash,
      role: UserRole.ADMIN,
      activeCompanyId: company.id,
    },
  });

  const [units, leads, pubs] = await Promise.all([
    prisma.productUnit.count({ where: { companyId: company.id } }),
    prisma.lead.count({ where: { companyId: company.id } }),
    prisma.publication.count({
      where: { channel: { companyId: company.id } },
    }),
  ]);

  console.log(JSON.stringify({ companyId: company.id, slug: company.slug, units, leads, publications: pubs }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
