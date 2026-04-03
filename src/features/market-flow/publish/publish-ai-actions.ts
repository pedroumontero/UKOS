"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { ModuleKey } from "@prisma/client";

import type { ImagePart } from "@/server/market-flow/inventory-ai-openai";
import { runPublicationListingAnalysis } from "@/server/market-flow/publish-ai-openai";
import type { PublicationListingAiResult } from "@/server/market-flow/publish-ai-schema";
import { db } from "@/server/db";
import { requireSession } from "@/server/auth";
import { userHasAccess } from "@/server/tenant-authorization";

type SettingsJson = {
  integrations?: {
    openaiApiKey?: string;
    openaiModel?: string;
  };
};

function guessMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

async function loadUnitImages(companyId: string, unitId: string): Promise<ImagePart[]> {
  const unit = await db.productUnit.findFirst({
    where: { id: unitId, companyId },
    include: {
      media: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 4,
      },
    },
  });

  if (!unit?.media.length) {
    return [];
  }

  const parts: ImagePart[] = [];
  for (const m of unit.media) {
    const rel = m.fileUrl.startsWith("/") ? m.fileUrl.slice(1) : m.fileUrl;
    const full = path.join(process.cwd(), "public", rel);
    try {
      const buf = await readFile(full);
      parts.push({
        base64: buf.toString("base64"),
        mimeType: guessMimeFromPath(full),
      });
    } catch {
      /* skip */
    }
  }
  return parts;
}

export type GeneratePublicationListingResult =
  | {
      ok: true;
      data: {
        listingTitle: string;
        listingDescription: string;
        priceHigh: string;
        priceMid: string;
        priceLow: string;
      };
    }
  | { ok: false; error: string };

function fmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

export async function generatePublicationListingAction(formData: FormData): Promise<GeneratePublicationListingResult> {
  try {
    const session = await requireSession();
    const { id: userId, activeCompanyId: companyId, role } = session.user;

    const can = await userHasAccess(userId, companyId, role, "market_flow.publish.manage");
    if (!can) {
      return { ok: false, error: "No tienes permiso para publicar en este modulo." };
    }

    const publicationId = String(formData.get("publicationId") || "").trim();
    if (!publicationId) {
      return { ok: false, error: "Falta la publicacion." };
    }

    const publication = await db.publication.findFirst({
      where: {
        id: publicationId,
        channel: { companyId },
      },
      include: {
        channel: true,
        unit: {
          include: { specs: true },
        },
      },
    });

    if (!publication) {
      return { ok: false, error: "Publicacion no encontrada." };
    }

    const images = await loadUnitImages(companyId, publication.unitId);
    if (!images.length) {
      return { ok: false, error: "La unidad no tiene fotos descargables para analizar." };
    }

    const settings = await db.companyModuleSettings.findUnique({
      where: {
        companyId_moduleKey: {
          companyId,
          moduleKey: ModuleKey.MARKET_FLOW,
        },
      },
    });

    const json = (settings?.settingsJson ?? {}) as SettingsJson;
    const apiKey = json.integrations?.openaiApiKey?.trim();
    const model = (json.integrations?.openaiModel?.trim() || "gpt-4o").replace(/^["']|["']$/g, "");

    if (!apiKey) {
      return {
        ok: false,
        error: "Configura la clave de OpenAI en Market Flow > Configuraciones > Integraciones.",
      };
    }

    const cost = publication.unit.costAmount?.toNumber?.() ?? Number(publication.unit.costAmount);
    const costNum = Number.isFinite(cost) ? cost : null;
    const sale = publication.unit.salePrice?.toNumber?.() ?? Number(publication.unit.salePrice);
    const saleNum = Number.isFinite(sale) ? sale : null;

    const specsText = publication.unit.specs.map((s) => `${s.key}: ${s.value}`).join("; ");

    const refreshKey =
      String(formData.get("refreshKey") || "").trim() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const data: PublicationListingAiResult = await runPublicationListingAnalysis({
      apiKey,
      model,
      images,
      channelName: publication.channel.displayName,
      channelCode: publication.channel.code,
      industryType: settings?.industryType?.trim() || "Tecnologia / Hardware",
      unitNumber: publication.unit.number,
      unitTitle: publication.unit.title,
      unitNotes: publication.unit.notes,
      specsText,
      cost: costNum,
      salePrice: saleNum,
      refreshKey,
    });

    return {
      ok: true,
      data: {
        listingTitle: data.listingTitle,
        listingDescription: data.listingDescription,
        priceHigh: fmt(data.priceHigh),
        priceMid: fmt(data.priceMid),
        priceLow: fmt(data.priceLow),
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar el listado.";
    console.error("[generatePublicationListingAction]", e);
    return { ok: false, error: message };
  }
}
