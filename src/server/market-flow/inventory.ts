import { ProductUnitStatus } from "@prisma/client";

import type { InventoryUnit } from "@/features/market-flow/inventory/types";
import { db } from "@/server/db";

const unitInclude = {
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
  leads: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
} as const;

function mapUnitRow(
  unit: {
    id: string;
    number: string;
    title: string;
    brand: string | null;
    model: string | null;
    category: string | null;
    condition: string | null;
    status: ProductUnitStatus;
    costAmount: { toString(): string } | null;
    salePrice: { toString(): string } | null;
    registeredAt: Date;
    notes: string | null;
    aiContext: string | null;
    media: Array<{
      id: string;
      fileUrl: string;
      fileName: string;
      sortOrder: number;
      isPrimary: boolean;
    }>;
    specs: Array<{ id: string; key: string; value: string }>;
    publications: Array<{
      id: string;
      status: string;
      generatedTitle: string | null;
      externalUrl: string | null;
      publishedAt: Date | null;
      publishedPrice: { toString(): string } | null;
      channel: { id: string; displayName: string; code: string };
    }>;
    leads: Array<{
      id: string;
      displayName: string;
      hasActiveConversation: boolean;
    }>;
  },
  activities: Array<{ id: string; entityId: string; label: string; createdAt: Date }>,
): InventoryUnit {
  return {
    id: unit.id,
    number: unit.number,
    title: unit.title,
    brand: unit.brand,
    model: unit.model,
    category: unit.category,
    condition: unit.condition,
    status: unit.status,
    costAmount: unit.costAmount?.toString() ?? null,
    salePrice: unit.salePrice?.toString() ?? null,
    registeredAt: unit.registeredAt,
    notes: unit.notes,
    aiContext: unit.aiContext,
    media: unit.media.map((media) => ({
      id: media.id,
      fileUrl: media.fileUrl,
      fileName: media.fileName,
      sortOrder: media.sortOrder,
      isPrimary: media.isPrimary,
    })),
    specs: unit.specs.map((spec) => ({
      id: spec.id,
      key: spec.key,
      value: spec.value,
    })),
    publications: unit.publications.map((publication) => ({
      id: publication.id,
      status: publication.status as InventoryUnit["publications"][number]["status"],
      generatedTitle: publication.generatedTitle,
      externalUrl: publication.externalUrl,
      publishedAt: publication.publishedAt,
      publishedPrice: publication.publishedPrice?.toString() ?? null,
      channel: {
        id: publication.channel.id,
        displayName: publication.channel.displayName,
        code: publication.channel.code,
      },
    })),
    leads: unit.leads.map((lead) => ({
      id: lead.id,
      displayName: lead.displayName,
      hasActiveConversation: lead.hasActiveConversation,
    })),
    activities: activities
      .filter((activity) => activity.entityId === unit.id)
      .slice(0, 10)
      .map((activity) => ({
        id: activity.id,
        label: activity.label,
        createdAt: activity.createdAt,
      })),
  };
}

export async function getInventoryUnit(companyId: string, unitId: string): Promise<InventoryUnit | null> {
  const unit = await db.productUnit.findFirst({
    where: { id: unitId, companyId },
    include: unitInclude,
  });

  if (!unit) {
    return null;
  }

  const activities = await db.activityLog.findMany({
    where: {
      companyId,
      entityType: "product_unit",
      entityId: unit.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return mapUnitRow(unit, activities);
}

export async function getInventoryUnits(companyId: string): Promise<InventoryUnit[]> {
  const units = await db.productUnit.findMany({
    where: { companyId },
    orderBy: { registeredAt: "desc" },
    include: unitInclude,
  });

  const activities = await db.activityLog.findMany({
    where: {
      companyId,
      entityType: "product_unit",
      entityId: {
        in: units.map((unit) => unit.id),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return units.map((unit) => mapUnitRow(unit, activities));
}

export async function getMarketFlowCounts(companyId: string) {
  const [unitsByStatus, leadCount, activeConversationCount, publicationRows] = await Promise.all([
    db.productUnit.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { status: true },
    }),
    db.lead.count({ where: { companyId } }),
    db.lead.count({ where: { companyId, hasActiveConversation: true } }),
    db.publication.findMany({
      where: {
        channel: {
          companyId,
        },
      },
      select: {
        channelId: true,
        status: true,
      },
    }),
  ]);

  const publications = publicationRows.reduce<
    Array<{ channelId: string; status: string; _count: { status: number } }>
  >((accumulator, row) => {
    const existing = accumulator.find(
      (item) => item.channelId === row.channelId && item.status === row.status,
    );

    if (existing) {
      existing._count.status += 1;
      return accumulator;
    }

    accumulator.push({
      channelId: row.channelId,
      status: row.status,
      _count: { status: 1 },
    });

    return accumulator;
  }, []);

  const counts = {
    totalUnits: 0,
    draft: 0,
    received: 0,
    readyToPublish: 0,
    published: 0,
    sold: 0,
    leadCount,
    activeConversationCount,
    publications,
  };

  for (const row of unitsByStatus) {
    counts.totalUnits += row._count.status;
    if (row.status === ProductUnitStatus.DRAFT) counts.draft = row._count.status;
    if (row.status === ProductUnitStatus.RECEIVED) counts.received = row._count.status;
    if (row.status === ProductUnitStatus.READY_TO_PUBLISH) counts.readyToPublish = row._count.status;
    if (row.status === ProductUnitStatus.PUBLISHED) counts.published = row._count.status;
    if (row.status === ProductUnitStatus.SOLD) counts.sold = row._count.status;
  }

  return counts;
}
