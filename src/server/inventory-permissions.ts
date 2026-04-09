import { ProductUnitStatus } from "@prisma/client";

import { userHasAccess } from "@/server/tenant-authorization";

type SessionUser = {
  id: string;
  activeCompanyId: string;
  role: string;
};

/**
 * Edición de unidad: `market_flow.inventory.edit`, o `create` si la unidad sigue en borrador
 * (flujo “nuevo producto” + borrador persistido para subida móvil).
 */
export async function canWriteInventoryUnit(
  user: SessionUser,
  unit: { companyId: string; status: ProductUnitStatus },
): Promise<boolean> {
  if (unit.companyId !== user.activeCompanyId) {
    return false;
  }

  const canEdit = await userHasAccess(user.id, user.activeCompanyId, user.role, "market_flow.inventory.edit");
  if (canEdit) {
    return true;
  }

  const canCreate = await userHasAccess(user.id, user.activeCompanyId, user.role, "market_flow.inventory.create");
  return canCreate && unit.status === ProductUnitStatus.DRAFT;
}
