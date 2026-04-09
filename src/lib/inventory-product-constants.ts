/** Título legacy de borradores; en UI se muestra en blanco hasta que la IA o el usuario lo definan. */
export const LEGACY_DRAFT_PRODUCT_TITLE = "Producto En Captura";

export function normalizeInventoryTitleFromForm(raw: string): string {
  const t = raw.trim();
  if (t === LEGACY_DRAFT_PRODUCT_TITLE) return "";
  return t;
}

/** Valor inicial para inputs de título (evita mostrar el placeholder legacy). */
export function titleForInventoryFormField(stored: string | null | undefined): string {
  if (!stored) return "";
  if (stored === LEGACY_DRAFT_PRODUCT_TITLE) return "";
  return stored;
}
