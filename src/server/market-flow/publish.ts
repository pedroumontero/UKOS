import type { Prisma } from "@prisma/client";
import { ProductUnitStatus, PublicationStatus } from "@prisma/client";

import { db } from "@/server/db";

/** Include compartido: cola Publicar + apertura por `publicacion=` desde Inventario. */
export const publicationForPublishPageInclude = {
  channel: true,
  unit: {
    include: {
      media: {
        orderBy: { sortOrder: "asc" as const },
      },
      specs: true,
      publications: {
        include: {
          channel: true,
        },
        orderBy: {
          channel: {
            sortOrder: "asc" as const,
          },
        },
      },
    },
  },
} satisfies Prisma.PublicationInclude;

export type PublicationForPublishPage = Prisma.PublicationGetPayload<{
  include: typeof publicationForPublishPageInclude;
}>;

export type PublishQueueEntry = {
  id: string;
  status: PublicationStatus;
  generatedTitle: string | null;
  generatedDescription: string | null;
  suggestedPriceHigh: string | null;
  suggestedPriceMid: string | null;
  suggestedPriceLow: string | null;
  publishedPrice: string | null;
  externalUrl: string | null;
  publishedAt: Date | null;
  channel: {
    id: string;
    displayName: string;
    code: string;
  };
  unit: {
    id: string;
    number: string;
    title: string;
    status: ProductUnitStatus;
    costAmount: string | null;
    salePrice: string | null;
    notes: string | null;
    media: Array<{ id: string; fileUrl: string; fileName: string }>;
    specs: Array<{ id: string; key: string; value: string }>;
    publications: Array<{
      id: string;
      status: PublicationStatus;
      channel: {
        id: string;
        displayName: string;
        code: string;
      };
    }>;
  };
};

export function toPublishQueueEntry(publication: PublicationForPublishPage): PublishQueueEntry {
  return {
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
  };
}

export async function getPublishQueue(companyId: string): Promise<PublishQueueEntry[]> {
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
    include: publicationForPublishPageInclude,
    orderBy: [
      { channel: { sortOrder: "asc" } },
      { unit: { registeredAt: "desc" } },
    ],
  });

  return publications.map(toPublishQueueEntry);
}

/**
 * Una publicación concreta (pendiente o ya publicada) para abrir desde Inventario vía `?publicacion=`.
 * No filtra por `channel.isEnabled` para no bloquear gestión legacy desde el modal.
 */
export async function getPublicationEntryById(
  companyId: string,
  publicationId: string,
): Promise<PublishQueueEntry | null> {
  const publication = await db.publication.findFirst({
    where: {
      id: publicationId,
      channel: { companyId },
      unit: { companyId },
    },
    include: publicationForPublishPageInclude,
  });

  return publication ? toPublishQueueEntry(publication) : null;
}
