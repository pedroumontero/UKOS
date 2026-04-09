import { ProductUnitStatus, PublicationStatus } from "@prisma/client";

export type InventoryUnit = {
  id: string;
  number: string;
  title: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  condition: string | null;
  status: ProductUnitStatus;
  costAmount: string | null;
  salePrice: string | null;
  registeredAt: Date;
  notes: string | null;
  /** Contexto para el asistente de IA; persistido en servidor. */
  aiContext: string | null;
  media: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  specs: Array<{
    id: string;
    key: string;
    value: string;
  }>;
  publications: Array<{
    id: string;
    status: PublicationStatus;
    generatedTitle: string | null;
    externalUrl: string | null;
    publishedAt: Date | null;
    publishedPrice: string | null;
    channel: {
      id: string;
      displayName: string;
      code: string;
    };
  }>;
  leads: Array<{
    id: string;
    displayName: string;
    hasActiveConversation: boolean;
  }>;
  activities: Array<{
    id: string;
    label: string;
    createdAt: Date;
  }>;
};
