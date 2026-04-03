"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus, LeadResolution, MessageAuthorType, MessageDirection } from "@prisma/client";

import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";

export async function createLeadAction(formData: FormData) {
  const session = await requireAccess("market_flow.leads.manage");
  const companyId = session.user.activeCompanyId;

  const displayName = String(formData.get("displayName") || "").trim();
  const contactValue = String(formData.get("contactValue") || "").trim() || undefined;
  const unitId = String(formData.get("unitId") || "").trim() || undefined;
  const channelId = String(formData.get("channelId") || "").trim() || undefined;
  const initialMessage = String(formData.get("initialMessage") || "").trim();

  if (!displayName) {
    return { ok: false, error: "Ingresa al menos un nombre o contacto." };
  }

  const publication = unitId && channelId
    ? await db.publication.findFirst({ where: { unitId, channelId } })
    : null;

  const lead = await db.lead.create({
    data: {
      companyId,
      displayName,
      contactValue,
      unitId,
      channelId,
      publicationId: publication?.id,
      resolution: LeadResolution.OPEN,
      hasActiveConversation: true,
      conversations: {
        create: {
          status: ConversationStatus.ACTIVE,
          summary: initialMessage || undefined,
          lastMessageAt: initialMessage ? new Date() : undefined,
          messages: initialMessage
            ? {
                create: {
                  direction: MessageDirection.INBOUND,
                  authorType: MessageAuthorType.LEAD,
                  content: initialMessage,
                },
              }
            : undefined,
        },
      },
    },
    include: {
      conversations: true,
    },
  });

  await db.activityLog.create({
    data: {
      companyId,
      actorUserId: session.user.id,
      entityType: "lead",
      entityId: lead.id,
      activityType: "created",
      label: `Lead ${lead.displayName} registrado en Market Flow`,
    },
  });

  revalidatePath("/market-flow/leads");
  revalidatePath("/market-flow/inventario");

  return { ok: true };
}

export async function addLeadMessageAction(formData: FormData) {
  const session = await requireAccess("market_flow.leads.manage");
  const companyId = session.user.activeCompanyId;
  const conversationId = String(formData.get("conversationId") || "");
  const content = String(formData.get("content") || "").trim();
  const direction = String(formData.get("direction") || MessageDirection.OUTBOUND) as MessageDirection;
  const authorType = direction === MessageDirection.OUTBOUND ? MessageAuthorType.HUMAN : MessageAuthorType.LEAD;

  if (!conversationId || !content) {
    return { ok: false, error: "No se pudo guardar el mensaje." };
  }

  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      lead: { companyId },
    },
    include: {
      lead: true,
    },
  });

  if (!conversation) {
    return { ok: false, error: "La conversacion no pertenece a la empresa activa." };
  }

  await db.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        conversationId,
        direction,
        authorType,
        content,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.ACTIVE,
        lastMessageAt: new Date(),
      },
    });

    await tx.lead.update({
      where: { id: conversation.leadId },
      data: {
        hasActiveConversation: true,
        resolution: LeadResolution.IN_CONVERSATION,
      },
    });
  });

  await db.activityLog.create({
    data: {
      companyId,
      actorUserId: session.user.id,
      entityType: "conversation",
      entityId: conversationId,
      activityType: "message_added",
      label: `Nuevo mensaje registrado para ${conversation.lead.displayName}`,
    },
  });

  revalidatePath("/market-flow/leads");

  return { ok: true };
}

export async function updateLeadResolutionAction(formData: FormData) {
  const session = await requireAccess("market_flow.leads.manage");
  const companyId = session.user.activeCompanyId;
  const leadId = String(formData.get("leadId") || "");
  const resolution = String(formData.get("resolution") || "") as LeadResolution;

  if (!leadId || !Object.values(LeadResolution).includes(resolution)) {
    return { ok: false, error: "No se pudo actualizar la resolucion." };
  }

  const lead = await db.lead.findFirst({
    where: {
      id: leadId,
      companyId,
    },
  });

  if (!lead) {
    return { ok: false, error: "El lead no pertenece a la empresa activa." };
  }

  await db.lead.update({
    where: { id: leadId },
    data: {
      resolution,
      hasActiveConversation: resolution === LeadResolution.OPEN || resolution === LeadResolution.IN_CONVERSATION,
    },
  });

  await db.activityLog.create({
    data: {
      companyId,
      actorUserId: session.user.id,
      entityType: "lead",
      entityId: leadId,
      activityType: "resolution_updated",
      label: `${lead.displayName} actualizado a resolucion ${resolution}`,
    },
  });

  revalidatePath("/market-flow/leads");
  return { ok: true };
}
