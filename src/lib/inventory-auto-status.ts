import { ProductUnitStatus } from "@prisma/client";

import { normalizeInventoryTitleFromForm } from "@/lib/inventory-product-constants";

function parseDecimalFieldForAuto(value: FormDataEntryValue | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Solo para intent `save-product` / Guardar cambios: asigna estado según completitud.
 * Sin título (o vacío) → DRAFT. Con título y faltan campos clave → RECEIVED. Todo completo → READY_TO_PUBLISH.
 */
export function computeAutoInventoryStatusFromForm(formData: FormData): ProductUnitStatus {
  const title = normalizeInventoryTitleFromForm(String(formData.get("title") ?? ""));
  if (!title) {
    return ProductUnitStatus.DRAFT;
  }

  const brand = String(formData.get("brand") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const condition = String(formData.get("condition") || "").trim();
  const deviceType = String(formData.get("deviceType") || "").trim();
  const ram = String(formData.get("ram") || "").trim();
  const ssd = String(formData.get("ssd") || "").trim();
  const cpu = String(formData.get("cpu") || "").trim();
  const color = String(formData.get("color") || "").trim();
  const costAmount = parseDecimalFieldForAuto(formData.get("costAmount"));
  const salePrice = parseDecimalFieldForAuto(formData.get("salePrice"));

  const allFilled =
    Boolean(brand) &&
    Boolean(model) &&
    Boolean(category) &&
    Boolean(condition) &&
    Boolean(deviceType) &&
    Boolean(ram) &&
    Boolean(ssd) &&
    Boolean(cpu) &&
    Boolean(color) &&
    costAmount !== null &&
    salePrice !== null;

  if (allFilled) {
    return ProductUnitStatus.READY_TO_PUBLISH;
  }
  return ProductUnitStatus.RECEIVED;
}
