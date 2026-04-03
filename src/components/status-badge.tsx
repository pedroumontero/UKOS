import { ProductUnitStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const labels: Record<ProductUnitStatus, string> = {
  DRAFT: "Borrador",
  RECEIVED: "Recibido",
  READY_TO_PUBLISH: "Listo Para Publicar",
  PUBLISHED: "Publicado",
  SOLD: "Vendido",
};

const variants: Record<ProductUnitStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  RECEIVED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  READY_TO_PUBLISH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  SOLD: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
};

export function StatusBadge({ status }: { status: ProductUnitStatus }) {
  return <Badge className={variants[status]}>{labels[status]}</Badge>;
}

export const productStatusOptions = [
  { value: ProductUnitStatus.DRAFT, label: labels.DRAFT },
  { value: ProductUnitStatus.RECEIVED, label: labels.RECEIVED },
  { value: ProductUnitStatus.READY_TO_PUBLISH, label: labels.READY_TO_PUBLISH },
  { value: ProductUnitStatus.PUBLISHED, label: labels.PUBLISHED },
  { value: ProductUnitStatus.SOLD, label: labels.SOLD },
];
