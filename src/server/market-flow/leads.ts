import { db } from "@/server/db";

export async function getLeads(companyId: string) {
  const leads = await db.lead.findMany({
    where: { companyId },
    include: {
      unit: true,
      publication: {
        include: {
          channel: true,
        },
      },
      channel: true,
      conversations: {
        include: {
          messages: {
            orderBy: { sentAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return leads.map((lead) => ({
    id: lead.id,
    displayName: lead.displayName,
    contactValue: lead.contactValue,
    createdAt: lead.createdAt,
    hasActiveConversation: lead.hasActiveConversation,
    resolution: lead.resolution,
    channel: lead.channel
      ? {
          id: lead.channel.id,
          displayName: lead.channel.displayName,
        }
      : null,
    unit: lead.unit
      ? {
          id: lead.unit.id,
          number: lead.unit.number,
          title: lead.unit.title,
          costAmount: lead.unit.costAmount?.toString() ?? null,
          salePrice: lead.unit.salePrice?.toString() ?? null,
        }
      : null,
    conversations: lead.conversations.map((conversation) => ({
      id: conversation.id,
      status: conversation.status,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        content: message.content,
        direction: message.direction,
        authorType: message.authorType,
        sentAt: message.sentAt,
      })),
    })),
  }));
}

export async function getLeadFormContext(companyId: string) {
  const [units, channels] = await Promise.all([
    db.productUnit.findMany({
      where: { companyId },
      orderBy: { registeredAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
      },
    }),
    db.channel.findMany({
      where: { companyId, isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        displayName: true,
      },
    }),
  ]);

  return { units, channels };
}
