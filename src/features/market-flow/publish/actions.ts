"use server";

import { revalidatePath } from "next/cache";
import { ProductUnitStatus, PublicationStatus } from "@prisma/client";

import { sanitizePublicationDescription, sanitizePublicationTitle } from "@/server/market-flow/publish-ai-schema";
import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";

function parseDecimal(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export async function savePublicationDraftAction(formData: FormData) {
  const session = await requireAccess("market_flow.publish.manage");
  const companyId = session.user.activeCompanyId;
  const publicationId = String(formData.get("publicationId") || "");

  if (!publicationId) {
    return { ok: false, error: "No se encontro la publicacion." };
  }

  const publication = await db.publication.findFirst({
    where: {
      id: publicationId,
      channel: { companyId },
    },
    include: { unit: true, channel: true },
  });

  if (!publication) {
    return { ok: false, error: "La publicacion no pertenece a la empresa activa." };
  }

  const generatedTitle = sanitizePublicationTitle(String(formData.get("generatedTitle") || "")) || undefined;
  const generatedDescription =
    sanitizePublicationDescription(String(formData.get("generatedDescription") || "")) || undefined;
  const suggestedPriceHigh = parseDecimal(formData.get("suggestedPriceHigh"));
  const suggestedPriceMid = parseDecimal(formData.get("suggestedPriceMid"));
  const suggestedPriceLow = parseDecimal(formData.get("suggestedPriceLow"));

  await db.publication.update({
    where: { id: publicationId },
    data: {
      generatedTitle,
      generatedDescription,
      suggestedPriceHigh,
      suggestedPriceMid,
      suggestedPriceLow,
    },
  });

  await db.activityLog.create({
    data: {
      companyId,
      actorUserId: session.user.id,
      entityType: "publication",
      entityId: publication.id,
      activityType: "draft_saved",
      label: `Borrador de ${publication.channel.displayName} actualizado para ${publication.unit.number}`,
    },
  });

  // Tras "Generar con IA" el cliente ya tiene titulo/descripcion en estado; revalidar aqui
  // dispara refresh del segmento y el modal de Publicar se desmonta / pierde `open`.
  const skipRevalidate = String(formData.get("ukosSkipRevalidate") || "") === "1";
  if (!skipRevalidate) {
    revalidatePath("/market-flow/publicar");
    revalidatePath("/market-flow/inventario");
  }

  return { ok: true };
}

export async function markPublicationAsPublishedAction(formData: FormData) {
  const session = await requireAccess("market_flow.publish.manage");
  const companyId = session.user.activeCompanyId;
  const publicationId = String(formData.get("publicationId") || "");

  if (!publicationId) {
    return { ok: false, error: "No se encontro la publicacion." };
  }

  const publication = await db.publication.findFirst({
    where: {
      id: publicationId,
      channel: { companyId },
    },
    include: {
      unit: true,
      channel: true,
    },
  });

  if (!publication) {
    return { ok: false, error: "La publicacion no pertenece a la empresa activa." };
  }

  const generatedTitle =
    sanitizePublicationTitle(
      String(formData.get("generatedTitle") || publication.generatedTitle || publication.unit.title),
    ) || sanitizePublicationTitle(publication.unit.title);
  const generatedDescriptionRaw = String(
    formData.get("generatedDescription") || publication.generatedDescription || publication.unit.notes || "",
  );
  const generatedDescription = sanitizePublicationDescription(generatedDescriptionRaw) || undefined;
  const publishedPrice = parseDecimal(formData.get("publishedPrice"));
  const externalUrlRaw = String(formData.get("externalUrl") || "").trim();
  if (!externalUrlRaw) {
    return { ok: false, error: "La URL externa del anuncio es obligatoria para publicar o actualizar la publicación." };
  }
  let externalUrl: string;
  try {
    const parsed = new URL(externalUrlRaw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "La URL externa debe usar http:// o https://." };
    }
    externalUrl = externalUrlRaw;
  } catch {
    return { ok: false, error: "La URL externa no es válida. Revisa el enlace completo." };
  }
  const publishedAtRaw = String(formData.get("publishedAt") || "").trim();
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();
  const suggestedPriceHigh = parseDecimal(formData.get("suggestedPriceHigh"));
  const suggestedPriceMid = parseDecimal(formData.get("suggestedPriceMid"));
  const suggestedPriceLow = parseDecimal(formData.get("suggestedPriceLow"));

  const cost = publication.unit.costAmount?.toNumber?.() ?? Number(publication.unit.costAmount);
  const costNum = Number.isFinite(cost) ? cost : null;
  if (costNum != null && costNum > 0 && publishedPrice != null) {
    const minPublished = Math.round(costNum * 1.3 * 100) / 100;
    if (publishedPrice + 1e-9 < minPublished) {
      return {
        ok: false,
        error: `El precio publicado debe ser al menos 30% superior al costo (minimo ${minPublished.toFixed(2)}).`,
      };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.publication.update({
      where: { id: publicationId },
      data: {
        status: PublicationStatus.PUBLISHED,
        generatedTitle,
        generatedDescription,
        suggestedPriceHigh,
        suggestedPriceMid,
        suggestedPriceLow,
        publishedPrice,
        externalUrl,
        publishedAt,
      },
    });

    if (publication.unit.status !== ProductUnitStatus.SOLD) {
      await tx.productUnit.update({
        where: { id: publication.unit.id },
        data: { status: ProductUnitStatus.PUBLISHED },
      });
    }

    await tx.activityLog.createMany({
      data: [
        {
          companyId,
          actorUserId: session.user.id,
          entityType: "publication",
          entityId: publication.id,
          activityType: "published",
          label: `${publication.unit.number} marcado como publicado en ${publication.channel.displayName}`,
        },
        {
          companyId,
          actorUserId: session.user.id,
          entityType: "product_unit",
          entityId: publication.unit.id,
          activityType: "status_updated",
          label: `${publication.unit.number} paso a Publicado por ${publication.channel.displayName}`,
        },
      ],
    });
  });

  revalidatePath("/market-flow/publicar");
  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/dashboard");

  return { ok: true };
}
