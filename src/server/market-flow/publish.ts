import { ProductUnitStatus, PublicationStatus } from "@prisma/client";

import { db } from "@/server/db";

export async function getPublishQueue(companyId: string) {
  const publications = await db.publication.findMany({
    where: {
      channel: {
        companyId,
        isEnabled: true,
      },
      status: PublicationStatus.PENDING,
      unit: {
        companyId,
        status: {
          in: [ProductUnitStatus.READY_TO_PUBLISH, ProductUnitStatus.PUBLISHED],
        },
      },
    },
    include: {
      channel: true,
      unit: {
        include: {
          media: {
            orderBy: { sortOrder: "asc" },
          },
          specs: true,
          publications: {
            include: {
              channel: true,
            },
            orderBy: {
              channel: {
                sortOrder: "asc",
              },
            },
          },
        },
      },
    },
    orderBy: [
      { channel: { sortOrder: "asc" } },
      { unit: { registeredAt: "desc" } },
    ],
  });

  return publications.map((publication) => ({
    id: publication.id,
    status: publication.status,
    generatedTitle: publication.generatedTitle,
    generatedDescription: publication.generatedDescription,
    suggestedPriceHigh: publication.suggestedPriceHigh?.toString() ?? null,
    suggestedPriceMid: publication.suggestedPriceMid?.toString() ?? null,
    suggestedPriceLow: publication.suggestedPriceLow?.toString() ?? null,
    publishedPrice: publication.publishedPrice?.toString() ?? null,
    externalUrl: publication.externalUrl,
    publishedAt: publication.publishedAt,
    channel: {
      id: publication.channel.id,
      displayName: publication.channel.displayName,
      code: publication.channel.code,
    },
    unit: {
      id: publication.unit.id,
      number: publication.unit.number,
      title: publication.unit.title,
      status: publication.unit.status,
      costAmount: publication.unit.costAmount?.toString() ?? null,
      salePrice: publication.unit.salePrice?.toString() ?? null,
      notes: publication.unit.notes,
      media: publication.unit.media.map((media) => ({
        id: media.id,
        fileUrl: media.fileUrl,
        fileName: media.fileName,
      })),
      specs: publication.unit.specs.map((spec) => ({
        id: spec.id,
        key: spec.key,
        value: spec.value,
      })),
      publications: publication.unit.publications.map((item) => ({
        id: item.id,
        status: item.status,
        channel: {
          id: item.channel.id,
          displayName: item.channel.displayName,
          code: item.channel.code,
        },
      })),
    },
  }));
}
