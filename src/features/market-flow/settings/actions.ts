"use server";

import { revalidatePath } from "next/cache";
import { ModuleKey } from "@prisma/client";

import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";

function slugifyCode(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

async function ensureMarketFlowSettings(companyId: string) {
  return db.companyModuleSettings.upsert({
    where: {
      companyId_moduleKey: {
        companyId,
        moduleKey: ModuleKey.MARKET_FLOW,
      },
    },
    update: {},
    create: {
      companyId,
      moduleKey: ModuleKey.MARKET_FLOW,
      industryType: "Tecnologia / Hardware",
      aiToneProfile: "Vendedor amable y profesional",
      defaultPriceStrategy: "manual",
    },
  });
}

export async function updateCompanyNameAction(formData: FormData) {
  const session = await requireAccess("market_flow.settings.edit");
  const companyId = session.user.activeCompanyId;
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    return { ok: false, error: "El nombre de la empresa no puede estar vacio." };
  }

  await db.company.update({
    where: { id: companyId },
    data: { name },
  });

  revalidatePath("/market-flow/configuraciones");
  revalidatePath("/dashboard");
  revalidatePath("/market-flow/dashboard");

  return { ok: true };
}

export async function updateMarketFlowSettingsAction(formData: FormData) {
  const session = await requireAccess("market_flow.settings.edit");
  const companyId = session.user.activeCompanyId;

  const industryType = String(formData.get("industryType") || "").trim();
  const aiToneProfile = String(formData.get("aiToneProfile") || "").trim();
  const defaultPriceStrategy = String(formData.get("defaultPriceStrategy") || "").trim();

  if (!industryType || !aiToneProfile || !defaultPriceStrategy) {
    return { ok: false, error: "Completa rubro, tono y estrategia de precio." };
  }

  await ensureMarketFlowSettings(companyId);

  await db.companyModuleSettings.update({
    where: {
      companyId_moduleKey: {
        companyId,
        moduleKey: ModuleKey.MARKET_FLOW,
      },
    },
    data: {
      industryType,
      aiToneProfile,
      defaultPriceStrategy,
    },
  });

  revalidatePath("/market-flow/configuraciones");

  return { ok: true };
}

type SettingsJson = Record<string, unknown> & {
  integrations?: {
    openaiApiKey?: string;
    openaiModel?: string;
  };
};

export async function updateIntegrationsSettingsAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAccess("market_flow.settings.edit");
  try {
    const companyId = session.user.activeCompanyId;

    const openaiApiKey = String(formData.get("openaiApiKey") || "").trim();
    const openaiModel = String(formData.get("openaiModel") || "").trim();

    const existing = await ensureMarketFlowSettings(companyId);
    const base = (existing.settingsJson as SettingsJson | null) ?? {};

    const next: SettingsJson = {
      ...base,
      integrations: {
        ...(typeof base.integrations === "object" && base.integrations ? base.integrations : {}),
        openaiApiKey: openaiApiKey || undefined,
        openaiModel: openaiModel || undefined,
      },
    };

    await db.companyModuleSettings.update({
      where: {
        companyId_moduleKey: {
          companyId,
          moduleKey: ModuleKey.MARKET_FLOW,
        },
      },
      data: { settingsJson: next as object },
    });

    revalidatePath("/market-flow/configuraciones");

    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudieron guardar las integraciones." };
  }
}

export async function toggleChannelAction(formData: FormData) {
  const session = await requireAccess("market_flow.settings.edit");
  const companyId = session.user.activeCompanyId;
  const channelId = String(formData.get("channelId") || "");
  const isEnabled = String(formData.get("isEnabled") || "") === "true";

  if (!channelId) {
    return { ok: false, error: "Canal invalido." };
  }

  const channel = await db.channel.findFirst({
    where: { id: channelId, companyId },
  });

  if (!channel) {
    return { ok: false, error: "Canal no encontrado." };
  }

  await db.channel.update({
    where: { id: channelId },
    data: { isEnabled },
  });

  revalidatePath("/market-flow/configuraciones");
  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/publicar");
  revalidatePath("/market-flow/leads");

  return { ok: true };
}

export async function createChannelAction(formData: FormData) {
  const session = await requireAccess("market_flow.settings.edit");
  const companyId = session.user.activeCompanyId;
  const displayName = String(formData.get("displayName") || "").trim();
  let code = String(formData.get("code") || "").trim();

  if (!displayName) {
    return { ok: false, error: "Indica el nombre visible del canal." };
  }

  if (!code) {
    code = slugifyCode(displayName) || `canal_${Date.now()}`;
  } else {
    code = slugifyCode(code);
  }

  const existingCode = await db.channel.findFirst({
    where: { companyId, code },
  });

  if (existingCode) {
    code = `${code}_${Date.now().toString(36)}`;
  }

  const last = await db.channel.findFirst({
    where: { companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const sortOrder = (last?.sortOrder ?? 0) + 1;

  const created = await db.channel.create({
    data: {
      companyId,
      code,
      displayName,
      isEnabled: true,
      sortOrder,
    },
  });

  const units = await db.productUnit.findMany({
    where: { companyId },
    select: { id: true },
  });

  if (units.length) {
    await db.publication.createMany({
      data: units.map((unit) => ({
        unitId: unit.id,
        channelId: created.id,
        status: "PENDING",
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/market-flow/configuraciones");
  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/publicar");

  return { ok: true };
}

export async function deleteChannelAction(formData: FormData) {
  const session = await requireAccess("market_flow.settings.edit");
  const companyId = session.user.activeCompanyId;
  const channelId = String(formData.get("channelId") || "");

  if (!channelId) {
    return { ok: false, error: "Canal invalido." };
  }

  const channel = await db.channel.findFirst({
    where: { id: channelId, companyId },
  });

  if (!channel) {
    return { ok: false, error: "Canal no encontrado." };
  }

  await db.channel.delete({
    where: { id: channelId },
  });

  revalidatePath("/market-flow/configuraciones");
  revalidatePath("/market-flow/inventario");
  revalidatePath("/market-flow/publicar");
  revalidatePath("/market-flow/leads");

  return { ok: true };
}
