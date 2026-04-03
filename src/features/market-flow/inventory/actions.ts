"use server";

import { revalidatePath } from "next/cache";

import { ProductUnitStatus, PublicationStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";
import { saveProductPhotos } from "@/server/market-flow/uploads";

function parseDecimal(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseStatus(value: FormDataEntryValue | null, fallback: ProductUnitStatus) {
  if (typeof value !== "string") {
    return fallback;
  }

  return (Object.values(ProductUnitStatus) as string[]).includes(value)
    ? (value as ProductUnitStatus)
    : fallback;
}

function getSpecDrafts(formData: FormData) {
  return [
    { key: "RAM", value: formData.get("ram") },
    { key: "SSD", value: formData.get("ssd") },
    { key: "CPU", value: formData.get("cpu") },
    { key: "Tipo De Equipo", value: formData.get("deviceType") },
    { key: "Color", value: formData.get("color") },
  ].filter((item): item is { key: string; value: string } => typeof item.value === "string" && item.value.trim().length > 0);
}

function actionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Body exceeded|413|body.*limit/i.test(message)) {
    return "Las fotos son demasiado grandes para enviarlas en una sola petición. Usa imágenes más pequeñas o menos archivos.";
  }
  if (/ENOSPC|no space/i.test(message)) {
    return "No hay espacio suficiente en el servidor para guardar las fotos.";
  }
  if (/EACCES|permission/i.test(message)) {
    return "El servidor no pudo escribir las fotos en disco. Revisa permisos o volumen de subidas.";
  }
  return "No se pudo guardar el producto. Revisa los datos e inténtalo de nuevo.";
}

export async function createProductUnitAction(formData: FormData) {
  try {
    const session = await requireAccess("market_flow.inventory.create");
    const companyId = session.user.activeCompanyId;
    const intent = formData.get("intent");
    const status = parseStatus(
      formData.get("status"),
      intent === "save-draft" ? ProductUnitStatus.DRAFT : ProductUnitStatus.RECEIVED,
    );

    const files = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (intent !== "save-draft" && files.length === 0) {
      return {
        ok: false,
        error: "Agrega al menos una foto para guardar el producto fuera de borrador.",
      };
    }

    const numberSeed = await db.productUnit.count({ where: { companyId } });
    const unitNumber = `UK-${String(numberSeed + 1).padStart(4, "0")}`;

    const title = String(formData.get("title") || "Producto En Captura").trim();
    const brand = String(formData.get("brand") || "").trim() || undefined;
    const model = String(formData.get("model") || "").trim() || undefined;
    const category = String(formData.get("category") || "").trim() || undefined;
    const condition = String(formData.get("condition") || "").trim() || undefined;
    const notes = String(formData.get("notes") || "").trim() || undefined;
    const costAmount = parseDecimal(formData.get("costAmount"));
    const salePrice = parseDecimal(formData.get("salePrice"));

    const savedPhotos = await saveProductPhotos(companyId, files);
    const channels = await db.channel.findMany({
      where: { companyId, isEnabled: true },
      orderBy: { sortOrder: "asc" },
    });

    const specCreates = getSpecDrafts(formData).map((item) => ({
      key: item.key,
      value: item.value,
      source: "manual",
    }));

    const unit = await db.productUnit.create({
      data: {
        companyId,
        number: unitNumber,
        title,
        brand,
        model,
        category,
        condition,
        status,
        costAmount,
        salePrice,
        notes,
        ...(specCreates.length
          ? {
              specs: {
                create: specCreates,
              },
            }
          : {}),
        ...(savedPhotos.length
          ? {
              media: {
                create: savedPhotos.map((photo, index) => ({
                  fileUrl: photo.fileUrl,
                  fileName: photo.fileName,
                  sortOrder: index,
                  isPrimary: index === 0,
                })),
              },
            }
          : {}),
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
        actorUserId: session.user.id,
        entityType: "product_unit",
        entityId: unit.id,
        activityType: "created",
        label:
          status === ProductUnitStatus.DRAFT
            ? "Producto guardado en borrador"
            : "Producto creado para flujo operativo",
      },
    });

    revalidatePath("/market-flow/inventario");
    revalidatePath("/market-flow/dashboard");
    revalidatePath("/market-flow/publicar");

    return {
      ok: true as const,
      unitId: unit.id,
    };
  } catch (error) {
    console.error("[createProductUnitAction]", error);
    return { ok: false as const, error: actionErrorMessage(error) };
  }
}

export async function updateProductUnitAction(formData: FormData) {
  try {
    const session = await requireAccess("market_flow.inventory.edit");
    const companyId = session.user.activeCompanyId;
    const unitId = String(formData.get("unitId") || "");

    if (!unitId) {
      return { ok: false as const, error: "No se encontro la unidad a editar." };
    }

    const existingUnit = await db.productUnit.findFirst({
      where: {
        id: unitId,
        companyId,
      },
      include: {
        specs: true,
        media: true,
      },
    });

    if (!existingUnit) {
      return { ok: false as const, error: "La unidad no pertenece a la empresa activa." };
    }

    const status = parseStatus(formData.get("status"), existingUnit.status);
    const title = String(formData.get("title") || existingUnit.title).trim();
    const brand = String(formData.get("brand") || "").trim() || undefined;
    const model = String(formData.get("model") || "").trim() || undefined;
    const category = String(formData.get("category") || "").trim() || undefined;
    const condition = String(formData.get("condition") || "").trim() || undefined;
    const notes = String(formData.get("notes") || "").trim() || undefined;
    const costAmount = parseDecimal(formData.get("costAmount"));
    const salePrice = parseDecimal(formData.get("salePrice"));

    const files = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const savedPhotos = await saveProductPhotos(companyId, files);

    await db.$transaction(async (tx) => {
      await tx.productUnit.update({
        where: { id: unitId },
        data: {
          title,
          brand,
          model,
          category,
          condition,
          status,
          costAmount,
          salePrice,
          notes,
          media: savedPhotos.length
            ? {
                create: savedPhotos.map((photo, index) => ({
                  fileUrl: photo.fileUrl,
                  fileName: photo.fileName,
                  sortOrder: existingUnit.media.length + index,
                  isPrimary: false,
                })),
              }
            : undefined,
        },
      });

      const specEntries = getSpecDrafts(formData);

      for (const entry of specEntries) {
        const existing = existingUnit.specs.find((spec) => spec.key === entry.key);
        if (existing) {
          await tx.productSpec.update({
            where: { id: existing.id },
            data: { value: entry.value, source: "manual" },
          });
        } else {
          await tx.productSpec.create({
            data: {
              unitId,
              key: entry.key,
              value: entry.value,
              source: "manual",
            },
          });
        }
      }

      await tx.activityLog.create({
        data: {
          companyId,
          actorUserId: session.user.id,
          entityType: "product_unit",
          entityId: unitId,
          activityType: "updated",
          label: `Unidad actualizada a estado ${status}`,
        },
      });
    });

    revalidatePath("/market-flow/inventario");
    revalidatePath("/market-flow/dashboard");
    revalidatePath("/market-flow/publicar");

    return { ok: true as const };
  } catch (error) {
    console.error("[updateProductUnitAction]", error);
    return { ok: false as const, error: actionErrorMessage(error) };
  }
}
