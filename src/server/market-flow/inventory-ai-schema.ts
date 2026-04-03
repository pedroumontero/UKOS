function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

/** Evita respuestas poco utiles del modelo. */
function cleanAiValue(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const lower = s.toLowerCase();
  if (
    lower === "unknown" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "desconocido" ||
    lower === "no se sabe" ||
    lower === "sin identificar"
  ) {
    return "";
  }
  return s;
}

export type InventoryVisionResult = {
  productType: string;
  category: string;
  brand: string;
  model: string;
  color: string;
  conditionEstimate: string;
  suggestedTitle: string;
  suggestedDescription: string;
  visibleNotes: string;
  ram: string;
  ssd: string;
  cpu: string;
  deviceType: string;
  publicationNotes: string;
  confidenceNote: string;
};

/** Normaliza JSON del modelo (claves opcionales o tipos sueltos). */
export function normalizeInventoryVisionResult(raw: unknown): InventoryVisionResult {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    productType: cleanAiValue(o.productType),
    category: cleanAiValue(o.category),
    brand: cleanAiValue(o.brand),
    model: cleanAiValue(o.model),
    color: cleanAiValue(o.color),
    conditionEstimate: cleanAiValue(o.conditionEstimate),
    suggestedTitle: cleanAiValue(o.suggestedTitle),
    suggestedDescription: cleanAiValue(o.suggestedDescription),
    visibleNotes: cleanAiValue(o.visibleNotes),
    ram: cleanAiValue(o.ram),
    ssd: cleanAiValue(o.ssd),
    cpu: cleanAiValue(o.cpu),
    deviceType: cleanAiValue(o.deviceType),
    publicationNotes: cleanAiValue(o.publicationNotes),
    confidenceNote: cleanAiValue(o.confidenceNote),
  };
}

export const inventoryVisionJsonSchemaHint = `{
  "productType": "string (tipo general, ej. laptop, telefono)",
  "category": "string (categoria comercial corta)",
  "brand": "string",
  "model": "string",
  "color": "string",
  "conditionEstimate": "string (estado visual estimado, breve)",
  "suggestedTitle": "string (titulo corto para listado)",
  "suggestedDescription": "string (1-3 frases para publicacion, sin inventar datos no visibles)",
  "visibleNotes": "string (detalles visibles: rayones, pantalla, teclado, etc.)",
  "ram": "string si se infiere o se lee en etiqueta, sino vacio",
  "ssd": "string si se infiere o se lee, sino vacio",
  "cpu": "string si se infiere o se lee, sino vacio",
  "deviceType": "string (sinonimo de tipo de equipo / factor)",
  "publicationNotes": "string (observaciones utiles para quien publica)",
  "confidenceNote": "string (opcional, que tan seguro estas o que falto ver)"
}`;
