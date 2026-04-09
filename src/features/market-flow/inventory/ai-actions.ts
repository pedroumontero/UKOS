"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { ModuleKey } from "@prisma/client";
import { APIConnectionError, APIConnectionTimeoutError } from "openai";

import { runInventoryVisionAnalysis, type ImagePart } from "@/server/market-flow/inventory-ai-openai";
import type { InventoryVisionResult } from "@/server/market-flow/inventory-ai-schema";
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

async function loadImagePartsFromUnit(companyId: string, unitId: string): Promise<ImagePart[]> {
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
      /* archivo ausente */
    }
  }
  return parts;
}

async function imagePartsFromUploads(files: File[]): Promise<ImagePart[]> {
  const parts: ImagePart[] = [];
  for (const f of files.slice(0, 4)) {
    if (!f.size) continue;
    const buf = Buffer.from(await f.arrayBuffer());
    parts.push({
      base64: buf.toString("base64"),
      mimeType: f.type && f.type.startsWith("image/") ? f.type : "image/jpeg",
    });
  }
  return parts;
}

export type AnalyzeInventoryPhotosResult =
  | { ok: true; data: InventoryVisionResult }
  | { ok: false; error: string };

export async function analyzeInventoryProductPhotosAction(formData: FormData): Promise<AnalyzeInventoryPhotosResult> {
  try {
    const session = await requireSession();
    const { id: userId, activeCompanyId: companyId, role } = session.user;

    const canEdit = await userHasAccess(userId, companyId, role, "market_flow.inventory.edit");
    const canCreate = await userHasAccess(userId, companyId, role, "market_flow.inventory.create");
    if (!canEdit && !canCreate) {
      return { ok: false, error: "No tienes permiso para usar la IA en inventario." };
    }

    const unitIdRaw = String(formData.get("unitId") || "").trim();
    const unitId = unitIdRaw || undefined;

    const uploads = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File && v.size > 0);

    let images: ImagePart[] = await imagePartsFromUploads(uploads);

    if (!images.length && unitId) {
      images = await loadImagePartsFromUnit(companyId, unitId);
    }

    if (!images.length) {
      return { ok: false, error: "Agrega al menos una foto (nueva o ya guardada en la unidad) para analizar." };
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
        error: "Falta la clave de OpenAI. Configurala en Market Flow > Configuraciones > Integraciones.",
      };
    }

    const industryType = settings?.industryType?.trim() || "Tecnologia / Hardware";

    const userContext = String(formData.get("userContext") || "").trim();

    let formHints: Record<string, string> = {};
    const rawHints = String(formData.get("formHints") || "").trim();
    if (rawHints) {
      try {
        const parsed = JSON.parse(rawHints) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          formHints = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).filter(
              ([, v]) => typeof v === "string" && v.trim().length > 0,
            ),
          ) as Record<string, string>;
        }
      } catch {
        /* ignorar JSON invalido */
      }
    }

    const data = await runInventoryVisionAnalysis({
      apiKey,
      model,
      images,
      industryType,
      userContext,
      formHints,
    });

    return { ok: true, data };
  } catch (e) {
    if (e instanceof APIConnectionTimeoutError) {
      console.error("[analyzeInventoryProductPhotosAction] OpenAI timeout", e);
      return {
        ok: false,
        error:
          "OpenAI tardó demasiado en responder. Prueba de nuevo; si persiste, usa menos fotos o imágenes más ligeras.",
      };
    }
    if (e instanceof APIConnectionError) {
      const cause = e.cause;
      console.error("[analyzeInventoryProductPhotosAction] OpenAI connection failed", cause ?? e);
      return {
        ok: false,
        error:
          "El servidor de UKOS no pudo conectar con OpenAI (no es fallo de tu navegador). " +
          "Comprueba que el host o contenedor Docker tenga salida HTTPS a api.openai.com, sin firewall bloqueando, " +
          "y DNS funcionando. Si usas proxy corporativo, configura las variables de entorno que use Node para HTTPS.",
      };
    }
    const message = e instanceof Error ? e.message : "Error al llamar a OpenAI.";
    console.error("[analyzeInventoryProductPhotosAction]", e);
    return { ok: false, error: message };
  }
}
