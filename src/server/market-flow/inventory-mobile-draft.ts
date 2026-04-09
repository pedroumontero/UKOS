import { ProductUnitStatus, PublicationStatus } from "@prisma/client";

import { db } from "@/server/db";

/**
 * Crea un `ProductUnit` real en DRAFT (sin fotos) para poder enlazar subidas móviles antes de rellenar el formulario.
 * Misma numeración UK-XXXX y publicaciones por canal que el alta manual.
 */
export async function createMinimalDraftProductUnitForMobile(params: {
  companyId: string;
  actorUserId: string;
}) {
  const { companyId, actorUserId } = params;

  const numberSeed = await db.productUnit.count({ where: { companyId } });
  const unitNumber = `UK-${String(numberSeed + 1).padStart(4, "0")}`;

  const channels = await db.channel.findMany({
    where: { companyId, isEnabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const unit = await db.productUnit.create({
    data: {
      companyId,
      number: unitNumber,
      title: "",
      status: ProductUnitStatus.DRAFT,
      ...(channels.length
        ? {
            publications: {
              create: channels.map((channel) => ({
                channelId: channel.id,
                status: PublicationStatus.PENDING,
              })),
            },
          }
        : {}),
    },
  });

  await db.activityLog.create({
    data: {
      companyId,
      actorUserId,
      entityType: "product_unit",
      entityId: unit.id,
      activityType: "created",
      label: "Borrador creado para subir fotos desde el móvil",
    },
  });

  return unit;
}
