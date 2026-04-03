import bcrypt from "bcryptjs";

import {
  LeadResolution,
  MessageAuthorType,
  MessageDirection,
  ModuleKey,
  PrismaClient,
  ProductUnitStatus,
  PublicationStatus,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const company = await prisma.company.upsert({
    where: { slug: "ukos-demo" },
    update: {},
    create: {
      name: "UKOS Demo",
      slug: "ukos-demo",
      defaultCurrency: "USD",
      timezone: "America/New_York",
    },
  });

  await prisma.companyModule.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: ModuleKey.MARKET_FLOW,
      },
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
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: ModuleKey.MARKET_FLOW,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      moduleKey: ModuleKey.MARKET_FLOW,
      industryType: "Tecnologia / Hardware",
      aiToneProfile: "Vendedor amable, persuasivo y profesional",
      defaultPriceStrategy: "manual",
      settingsJson: {
        theme: "light-premium",
      },
    },
  });

  const channelSeeds = [
    { code: "facebook_marketplace", displayName: "Facebook Marketplace", sortOrder: 1 },
    { code: "offerup", displayName: "OfferUp", sortOrder: 2 },
    { code: "ebay", displayName: "eBay", sortOrder: 3 },
  ];

  for (const channel of channelSeeds) {
    await prisma.channel.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: channel.code,
        },
      },
      update: {
        displayName: channel.displayName,
        sortOrder: channel.sortOrder,
        isEnabled: true,
      },
      create: {
        companyId: company.id,
        code: channel.code,
        displayName: channel.displayName,
        sortOrder: channel.sortOrder,
        isEnabled: true,
      },
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@ukos.local" },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      activeCompanyId: company.id,
    },
    create: {
      email: "admin@ukos.local",
      name: "UKOS Admin",
      passwordHash,
      role: UserRole.ADMIN,
      activeCompanyId: company.id,
    },
  });

  const channels = await prisma.channel.findMany({
    where: { companyId: company.id },
    orderBy: { sortOrder: "asc" },
  });

  const unitSeeds = [
    {
      number: "UK-0001",
      title: "Dell Latitude 5420 16GB / 512GB",
      brand: "Dell",
      model: "Latitude 5420",
      category: "Laptop",
      condition: "Muy Buena",
      status: ProductUnitStatus.RECEIVED,
      costAmount: "320.00",
      salePrice: "480.00",
      specs: {
        RAM: "16GB",
        SSD: "512GB",
        CPU: "Intel Core i5",
      },
    },
    {
      number: "UK-0002",
      title: "HP EliteBook 840 G8 16GB / 256GB",
      brand: "HP",
      model: "EliteBook 840 G8",
      category: "Laptop",
      condition: "Buena",
      status: ProductUnitStatus.READY_TO_PUBLISH,
      costAmount: "290.00",
      salePrice: "450.00",
      specs: {
        RAM: "16GB",
        SSD: "256GB",
        CPU: "Intel Core i5",
      },
    },
  ];

  for (const seed of unitSeeds) {
    const unit = await prisma.productUnit.upsert({
      where: {
        companyId_number: {
          companyId: company.id,
          number: seed.number,
        },
      },
      update: {
        title: seed.title,
        brand: seed.brand,
        model: seed.model,
        category: seed.category,
        condition: seed.condition,
        status: seed.status,
        costAmount: seed.costAmount,
        salePrice: seed.salePrice,
      },
      create: {
        companyId: company.id,
        number: seed.number,
        title: seed.title,
        brand: seed.brand,
        model: seed.model,
        category: seed.category,
        condition: seed.condition,
        status: seed.status,
        costAmount: seed.costAmount,
        salePrice: seed.salePrice,
      },
    });

    const existingSpecs = await prisma.productSpec.findMany({
      where: { unitId: unit.id },
    });

    for (const [key, value] of Object.entries(seed.specs)) {
      const existingSpec = existingSpecs.find((spec) => spec.key === key);
      if (existingSpec) {
        await prisma.productSpec.update({
          where: { id: existingSpec.id },
          data: { value, source: "manual" },
        });
      } else {
        await prisma.productSpec.create({
          data: {
            unitId: unit.id,
            key,
            value,
            source: "manual",
          },
        });
      }
    }

    for (const channel of channels) {
      await prisma.publication.upsert({
        where: {
          unitId_channelId: {
            unitId: unit.id,
            channelId: channel.id,
          },
        },
        update: {
          status: PublicationStatus.PENDING,
          generatedTitle: `${seed.brand} ${seed.model} ${seed.specs.RAM} / ${seed.specs.SSD}`,
          generatedDescription: `${seed.title}. Equipo listo para publicarse en ${channel.displayName}.`,
          suggestedPriceHigh: seed.salePrice,
          suggestedPriceMid: seed.salePrice,
          suggestedPriceLow: seed.costAmount,
        },
        create: {
          unitId: unit.id,
          channelId: channel.id,
          status: PublicationStatus.PENDING,
          generatedTitle: `${seed.brand} ${seed.model} ${seed.specs.RAM} / ${seed.specs.SSD}`,
          generatedDescription: `${seed.title}. Equipo listo para publicarse en ${channel.displayName}.`,
          suggestedPriceHigh: seed.salePrice,
          suggestedPriceMid: seed.salePrice,
          suggestedPriceLow: seed.costAmount,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        companyId: company.id,
        actorUserId: adminUser.id,
        entityType: "product_unit",
        entityId: unit.id,
        activityType: "seeded",
        label: `Unidad ${seed.number} preparada para demo inicial`,
      },
    });
  }

  const demoUnit = await prisma.productUnit.findFirst({
    where: { companyId: company.id },
    orderBy: { registeredAt: "desc" },
  });

  const facebookChannel = channels.find((channel) => channel.code === "facebook_marketplace");

  if (demoUnit) {
    const publication = facebookChannel
      ? await prisma.publication.findUnique({
          where: {
            unitId_channelId: {
              unitId: demoUnit.id,
              channelId: facebookChannel.id,
            },
          },
        })
      : null;

    const lead = await prisma.lead.upsert({
      where: { id: `demo-lead-${company.id}` },
      update: {
        displayName: "Pedro Marketplace",
        contactValue: "@pedrohardware",
        channelId: facebookChannel?.id,
        unitId: demoUnit.id,
        publicationId: publication?.id,
        resolution: LeadResolution.IN_CONVERSATION,
        hasActiveConversation: true,
      },
      create: {
        id: `demo-lead-${company.id}`,
        companyId: company.id,
        displayName: "Pedro Marketplace",
        contactValue: "@pedrohardware",
        channelId: facebookChannel?.id,
        unitId: demoUnit.id,
        publicationId: publication?.id,
        resolution: LeadResolution.IN_CONVERSATION,
        hasActiveConversation: true,
      },
    });

    const conversation = await prisma.conversation.upsert({
      where: { id: `demo-conversation-${company.id}` },
      update: {
        status: "ACTIVE",
        lastMessageAt: new Date(),
      },
      create: {
        id: `demo-conversation-${company.id}`,
        leadId: lead.id,
        status: "ACTIVE",
        summary: "Conversacion demo para validar Leads V1.",
        lastMessageAt: new Date(),
      },
    });

    const existingMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
    });

    if (!existingMessages.length) {
      await prisma.message.createMany({
        data: [
          {
            conversationId: conversation.id,
            direction: MessageDirection.INBOUND,
            authorType: MessageAuthorType.LEAD,
            content: "Hola, sigue disponible el equipo?",
          },
          {
            conversationId: conversation.id,
            direction: MessageDirection.OUTBOUND,
            authorType: MessageAuthorType.HUMAN,
            content: "Si, sigue disponible. Te puedo compartir mas fotos y el precio final publicado.",
          },
        ],
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
