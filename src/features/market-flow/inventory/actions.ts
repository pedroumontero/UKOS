"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";

import { Prisma, ProductUnitStatus, PublicationStatus } from "@prisma/client";
import { requireSession } from "@/server/auth";
import { db } from "@/server/db";
import { canWriteInventoryUnit } from "@/server/inventory-permissions";
import { requireAccess } from "@/server/tenant-authorization";
import {
  INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE,
  validateInventoryPhotoPayload,
} from "@/features/market-flow/inventory/upload-limits";
import { computeAutoInventoryStatusFromForm } from "@/lib/inventory-auto-status";
import { normalizeInventoryTitleFromForm } from "@/lib/inventory-product-constants";
import { saveProductPhotos } from "@/server/market-flow/uploads";

async function removeUploadFileFromDisk(fileUrl: string) {
  const relative = fileUrl.replace(/^\//, "");
  const fullPath = path.join(process.cwd(), "public", relative);
  try {
    await unlink(fullPath);
  } catch {
    // archivo ya borrado o ruta invalida
  }
}

function parseDecimal(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/** Para updates: vacío o inválido → null en BD (limpiar costo/precio). */
function parseDecimalField(value: FormDataEntryValue | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseAiContextField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const INVENTORY_SPEC_FORM_MAP = [
  { field: "ram", key: "RAM" },
  { field: "ssd", key: "SSD" },
  { field: "cpu", key: "CPU" },
  { field: "deviceType", key: "Tipo De Equipo" },
  { field: "color", key: "Color" },
] as const;

/**
 * Valores alineados con `enum ProductUnitStatus` en schema.prisma.
 * No usar solo `Object.values(ProductUnitStatus)` en Server Actions: en algunos bundles el objeto enum
 * puede quedar vacío en runtime y haría fallar el reconocimiento de estados como READY_TO_PUBLISH.
 */
const PRODUCT_UNIT_STATUSES: ProductUnitStatus[] = [
  ProductUnitStatus.DRAFT,
  ProductUnitStatus.RECEIVED,
  ProductUnitStatus.READY_TO_PUBLISH,
  ProductUnitStatus.PUBLISHED,
  ProductUnitStatus.SOLD,
];

function parseStatus(value: FormDataEntryValue | null, fallback: ProductUnitStatus) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return PRODUCT_UNIT_STATUSES.includes(trimmed as ProductUnitStatus)
    ? (trimmed as ProductUnitStatus)
    : fallback;
}

function getSpecDrafts(formData: FormData): Array<{ key: string; value: string }> {
  return INVENTORY_SPEC_FORM_MAP.map(({ field, key }) => {
    const raw = formData.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    return { key, value };
  }).filter((item) => item.value.length > 0);
}

function actionErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const detail = error.message.replace(/\s+/g, " ").trim().slice(0, 240);
    if (/invalid.*enum|unsafe.*enum|ProductUnitStatus/i.test(detail)) {
      return (
        `La base de datos rechazó el estado del producto (${error.code}). ` +
        "Suele indicar que el enum en PostgreSQL no coincide con Prisma (falta migrar). " +
        `Detalle: ${detail}`
      );
    }
    return `No se pudo guardar (${error.code}). ${detail}`;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    const msg = error.message.replace(/\s+/g, " ").trim();
    if (/status|ProductUnitStatus/i.test(msg) && /Invalid|enum|Expected/i.test(msg)) {
      return (
        "El estado del producto no es aceptado por el servidor. " +
        "Comprueba que exista READY_TO_PUBLISH en el enum de la BD (`prisma migrate deploy`). " +
        `Detalle: ${msg.slice(0, 260)}`
      );
    }
    return `Datos inválidos al guardar: ${msg.slice(0, 280)}`;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message === INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE) {
    return INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE;
  }
  if (/Body exceeded|413|body.*limit/i.test(message)) {
    return INVENTORY_PHOTOS_LIMIT_EXCEEDED_MESSAGE;
  }
  if (/invalid.*enum|ProductUnitStatus|READY_TO_PUBLISH/i.test(message)) {
    return (
      "Error al guardar el estado del producto. " +
      "Si la base fue creada antes del enum completo, ejecuta las migraciones de Prisma. " +
      `Detalle: ${message.replace(/\s+/g, " ").trim().slice(0, 220)}`
    );
  }
  if (/ENOSPC|no space/i.test(message)) {
    return "No hay espacio suficiente en el servidor para guardar las fotos.";
  }
  if (/EACCES|permission/i.test(message)) {
    return "El servidor no pudo escribir las fotos en disco. Revisa permisos o volumen de subidas.";
  }
  return `No se pudo guardar el producto. ${message.replace(/\s+/g, " ").trim().slice(0, 200)}`;
}

export async function createProductUnitAction(formData: FormData) {
  try {
    const session = await requireAccess("market_flow.inventory.create");
    const companyId = session.user.activeCompanyId;
    const intent = formData.get("intent");
    const files = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    const photoLimitError = validateInventoryPhotoPayload(files);
    if (photoLimitError) {
      return { ok: false as const, error: photoLimitError };
    }

    if (intent !== "save-draft" && files.length === 0) {
      return {
        ok: false,
        error: "Agrega al menos una foto para guardar el producto fuera de borrador.",
      };
    }

    let status: ProductUnitStatus;
    if (intent === "save-draft") {
      status = parseStatus(formData.get("status"), ProductUnitStatus.DRAFT);
    } else {
      status = computeAutoInventoryStatusFromForm(formData);
    }

    const numberSeed = await db.productUnit.count({ where: { companyId } });
    const unitNumber = `UK-${String(numberSeed + 1).padStart(4, "0")}`;

    const title = normalizeInventoryTitleFromForm(String(formData.get("title") ?? ""));
    const brand = String(formData.get("brand") || "").trim() || undefined;
    const model = String(formData.get("model") || "").trim() || undefined;
    const category = String(formData.get("category") || "").trim() || undefined;
    const condition = String(formData.get("condition") || "").trim() || undefined;
    const notes = String(formData.get("notes") || "").trim() || undefined;
    const costAmount = parseDecimal(formData.get("costAmount"));
    const salePrice = parseDecimal(formData.get("salePrice"));
    const aiContext = parseAiContextField(formData.get("aiContext"));

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
        aiContext,
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
    const session = await requireSession();
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

    const allowedWrite = await canWriteInventoryUnit(session.user, existingUnit);
    if (!allowedWrite) {
      return { ok: false as const, error: "No tienes permiso para editar esta unidad." };
    }

    const intent = formData.get("intent");
    const files = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    const photoLimitErrorUpdate = validateInventoryPhotoPayload(files);
    if (photoLimitErrorUpdate) {
      return { ok: false as const, error: photoLimitErrorUpdate };
    }

    let status: ProductUnitStatus;
    if (intent === "save-draft") {
      status = parseStatus(formData.get("status"), existingUnit.status);
    } else if (intent === "save-product") {
      status = computeAutoInventoryStatusFromForm(formData);
    } else {
      status = parseStatus(formData.get("status"), existingUnit.status);
    }

    const title = normalizeInventoryTitleFromForm(String(formData.get("title") ?? ""));
    const brand = String(formData.get("brand") || "").trim() || undefined;
    const model = String(formData.get("model") || "").trim() || undefined;
    const category = String(formData.get("category") || "").trim() || undefined;
    const condition = String(formData.get("condition") || "").trim() || undefined;
    const notes = String(formData.get("notes") || "").trim() || undefined;
    const costAmount = parseDecimalField(formData.get("costAmount"));
    const salePrice = parseDecimalField(formData.get("salePrice"));
    const aiContext = parseAiContextField(formData.get("aiContext"));
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
          aiContext,
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

      for (const { field, key: specKey } of INVENTORY_SPEC_FORM_MAP) {
        const raw = formData.get(field);
        const value = typeof raw === "string" ? raw.trim() : "";
        const existing = existingUnit.specs.find((spec) => spec.key === specKey);
        if (value) {
          if (existing) {
            await tx.productSpec.update({
              where: { id: existing.id },
              data: { value, source: "manual" },
            });
          } else {
            await tx.productSpec.create({
              data: {
                unitId,
                key: specKey,
                value,
                source: "manual",
              },
            });
          }
        } else if (existing) {
          await tx.productSpec.delete({ where: { id: existing.id } });
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

export async function deleteProductUnitAction(unitId: string) {
  try {
    const session = await requireAccess("market_flow.inventory.delete");
    const companyId = session.user.activeCompanyId;
    const id = String(unitId || "").trim();
    if (!id) {
      return { ok: false as const, error: "Unidad no especificada." };
    }

    const unit = await db.productUnit.findFirst({
      where: { id, companyId },
      include: { media: true },
    });

    if (!unit) {
      return { ok: false as const, error: "La unidad no existe o no pertenece a la empresa activa." };
    }

    for (const m of unit.media) {
      await removeUploadFileFromDisk(m.fileUrl);
    }

    await db.$transaction(async (tx) => {
      await tx.activityLog.create({
        data: {
          companyId,
          actorUserId: session.user.id,
          entityType: "product_unit",
          entityId: id,
          activityType: "deleted",
          label: `Unidad eliminada: ${unit.number} — ${unit.title}`,
        },
      });
      await tx.productUnit.delete({ where: { id } });
    });

    revalidatePath("/market-flow/inventario");
    revalidatePath("/market-flow/dashboard");
    revalidatePath("/market-flow/publicar");
    revalidatePath("/market-flow/leads");

    return { ok: true as const };
  } catch (error) {
    console.error("[deleteProductUnitAction]", error);
    return { ok: false as const, error: actionErrorMessage(error) };
  }
}
