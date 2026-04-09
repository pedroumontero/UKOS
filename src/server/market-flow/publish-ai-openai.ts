import OpenAI from "openai";

import {
  clampListingCopyForChannel,
  enforcePublicationPriceRules,
  normalizePublicationListingResult,
  type PublicationListingAiResult,
} from "@/server/market-flow/publish-ai-schema";
import type { ImagePart } from "@/server/market-flow/inventory-ai-openai";

export type { ImagePart };

/** Referencias publicas / uso real; el modelo debe respetarlas (no son garantia legal). */
function channelLimitRules(channelCode: string): string {
  switch (channelCode) {
    case "facebook_marketplace":
      return (
        "Facebook Marketplace (referencia Meta / practica comun): titulo hasta ~200 caracteres como tope orientativo; en feed movil muchos usuarios solo ven ~60-90 caracteres iniciales, asi que pon marca, modelo y lo esencial al principio. " +
        "Descripcion: suele admitir textos largos; manten el total razonable (orientativo max ~5000 caracteres) para que pegar en la app no falle."
      );
    case "ebay":
      return (
        "eBay: muchos formatos de anuncio limitan el titulo a ~80 caracteres; trata ese como maximo estricto para listingTitle. Descripcion larga permitida (orientativo max ~5000 caracteres)."
      );
    case "offerup":
      return (
        "OfferUp: titulo relativamente corto; usa ~100 caracteres como guia maxima para listingTitle. Descripcion estructurada (orientativo max ~5000 caracteres)."
      );
    default:
      return (
        "Canal generico: titulo hasta ~200 caracteres como guia; descripcion hasta ~5000 caracteres. Ante duda, titulo mas corto y denso al inicio."
      );
  }
}

function channelTitleAndDescriptionStyle(channelCode: string): string {
  const bilingual =
    "OBLIGATORIO mercado USA: listingDescription en DOS IDIOMAS. " +
    "Orden: (1) bloque completo en ESPANOL con \\n\\n entre secciones; " +
    "(2) una linea que contenga UNICAMENTE exactamente estos 10 caracteres: ---------- (sin espacios, sin texto, sin emojis, sin banderas); " +
    "(3) linea en blanco; " +
    "(4) bloque completo en INGLES con las mismas secciones. " +
    "PROHIBIDO escribir 'English', 'Ingles', banderas o 🇺🇸 en el separador — solo la linea de guiones. " +
    "Texto PLANO: sin markdown (** o *), sin backticks. ";

  const titleNoEmoji =
    "listingTitle: REGLA ABSOLUTA cero emojis, cero simbolos pictoricos, cero banderas — solo letras, numeros, espacios y caracteres como | - ( ). " +
    "Formato denso: Marca Modelo | CPU resumida | RAM | SSD | Win11 (ejemplo). ";

  switch (channelCode) {
    case "facebook_marketplace":
      return (
        bilingual +
        titleNoEmoji +
        "Descripcion: emojis permitidos solo en cuerpo (ej. ⚙️ titulo de seccion), no en listingTitle. " +
        "Tono directo de clasificado; evita frases de marketing tipo 'Descubre la eficiencia', 'combina rendimiento y diseno elegante', 'perfecto para tu espacio'. " +
        "Secciones: intro corta; especificaciones en lista; condicion; ideal para; incluye; cierre. Hechos alineados a fotos/notas."
      );
    case "ebay":
      return (
        bilingual +
        titleNoEmoji +
        "Descripcion: secciones ES/EN; datos tecnicos claros; emojis opcionales solo en descripcion."
      );
    case "offerup":
      return (
        bilingual +
        titleNoEmoji +
        "Descripcion: bloques ES y EN; emojis solo en descripcion si aportan."
      );
    default:
      return (
        bilingual +
        titleNoEmoji +
        "Descripcion bilingue con secciones paralelas; emojis solo en descripcion."
      );
  }
}

export async function runPublicationListingAnalysis(params: {
  apiKey: string;
  model: string;
  images: ImagePart[];
  channelName: string;
  channelCode: string;
  industryType: string;
  unitNumber: string;
  unitTitle: string;
  unitNotes: string | null;
  specsText: string;
  cost: number | null;
  salePrice: number | null;
  /** Un valor distinto en cada clic para forzar redaccion y precios nuevos. */
  refreshKey: string;
}): Promise<PublicationListingAiResult> {
  const {
    apiKey,
    model,
    images,
    channelName,
    channelCode,
    industryType,
    unitNumber,
    unitTitle,
    unitNotes,
    specsText,
    cost,
    salePrice,
    refreshKey,
  } = params;

  if (!images.length) {
    throw new Error("No hay imagenes para analizar.");
  }

  const costLow  = cost != null && Number.isFinite(cost) ? Math.round(cost * 1.15) : null;
  const costMid  = cost != null && Number.isFinite(cost) ? Math.round(cost * 1.30) : null;
  const costHigh = cost != null && Number.isFinite(cost) ? Math.round(cost * 1.50) : null;

  const costLine =
    cost != null && Number.isFinite(cost)
      ? `Costo interno (NO mostrar al comprador): ${cost}. POLITICA DE PRECIOS OPTIMISTA — obligatoria, prioriza ganancia sobre velocidad de venta: ` +
        `priceLow minimo ${costLow} (~15% sobre costo, piso estrategico — no es precio de oferta); ` +
        `priceMid minimo ${costMid} (~30% sobre costo, precio objetivo real); ` +
        `priceHigh minimo ${costHigh} (~50% sobre costo, precio ambicioso de lista). ` +
        `NUNCA sugerir precios cercanos al costo. El sistema rechazara automaticamente cualquier sugerencia inferior a estos pisos.`
      : "No se indico costo; propone precios ALTOS coherentes con el mercado refurb USA. Sé optimista: prioriza margen alto sobre velocidad de venta.";

  const saleLine =
    salePrice != null && Number.isFinite(salePrice)
      ? `Precio objetivo de venta en inventario (referencia, puedes ajustar para el canal): ${salePrice}.`
      : "";

  const limits = channelLimitRules(channelCode);
  const style = channelTitleAndDescriptionStyle(channelCode);

  const inventoryBlock =
    `--- Datos del inventario (unica fuente escrita de hechos; contrastar con fotos) ---\n` +
    `Titulo en sistema: ${unitTitle}\n` +
    `Notas / descripcion interna: ${unitNotes || "(ninguna)"}\n` +
    `Especificaciones: ${specsText || "(ninguna)"}\n`;

  const jsonKeys = `{
  "listingTitle": "string",
  "listingDescription": "string (espanol completo; linea ---------- ; ingles completo; \\n\\n entre bloques; sin ** ni markdown)",
  "priceHigh": number,
  "priceMid": number,
  "priceLow": number
}`;

  const refreshBlock =
    `SOLICITUD DE REGENERACION (id: ${refreshKey}): el usuario pulso de nuevo Generar con IA. ` +
    `Debes producir un anuncio COMPLETAMENTE NUEVO en esta respuesta: otro titulo (misma informacion factual), otra redaccion en espanol e ingles (misma estructura de secciones pero distintas frases y orden cuando sea posible), ` +
    `y otra propuesta numerica de priceHigh, priceMid, priceLow (siempre coherentes con costo y mercado). ` +
    `No reutilices plantillas fijas ni copia literal de ejemplos.\n\n`;

  const textIntro =
    refreshBlock +
    `Redactas anuncios para publicar en "${channelName}" (codigo ${channelCode}). Publico: Estados Unidos (compradores en ingles y espanol).\n` +
    `LIMITES Y PLATAFORMA:\n${limits}\n\n` +
    `ESTILO DE TITULO Y DESCRIPCION:\n${style}\n\n` +
    `Rubro del negocio: ${industryType}. Referencia interna de unidad: ${unitNumber}.\n` +
    `${inventoryBlock}\n` +
    `${costLine} ${saleLine}\n` +
    `TITULO (listingTitle): estilo Facebook Marketplace — corto, claro y comercial. Ejemplos: "Dell Latitude 5420 i5 11th Gen 8GB RAM SSD Rapida Lista Para Usar" o "HP EliteBook 840 G8 Core i7 16GB RAM 512GB SSD Win11". Sin codigos internos, sin strings largos tipo inventario, sin texto frio.\n` +
    `DESCRIPCION (listingDescription): comercial y persuasiva — resalta rapidez, disponibilidad inmediata y caso de uso. Separa ES e EN con la linea ---------- exactamente. Nunca uses '🇺🇸 English' como separador.\n` +
    `PRECIOS: priceHigh, priceMid, priceLow en JSON numerico. Orden: priceHigh >= priceMid >= priceLow. Aplica pisos de margen indicados.\n` +
    `Responde SOLO JSON valido con estas claves exactas:\n${jsonKeys}`;

  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: textIntro }];

  for (const img of images) {
    const mime = img.mimeType || "image/jpeg";
    parts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${img.base64}`, detail: "auto" },
    });
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 4500,
    temperature: 0.82,
    presence_penalty: 0.35,
    frequency_penalty: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Especialista en anuncios de tecnologia segunda mano/refurb para marketplaces en USA. " +
          "MENTALIDAD: vendedor comercial y directo estilo Facebook Marketplace. Titulos cortos, densos y de impacto maximo. " +
          "listingTitle: NUNCA emojis ni pictogramas — solo texto. Formato Marketplace: Marca Modelo CPU RAM SSD Estado (ejemplo: Dell Latitude 5420 i5 11th Gen 8GB RAM 256GB SSD Win11 Lista). " +
          "listingDescription: tono persuasivo y humano — resalta beneficios reales: rapida, lista para trabajar, ideal para oficina/estudio/hogar. " +
          "Estructura descripcion: (1) intro corta con beneficio clave; (2) especificaciones en lista; (3) condicion del equipo; (4) ideal para quien; (5) que incluye; (6) cierre con llamada a accion. " +
          "Bilingue ES completo, luego ----------, luego EN completo. Sin markdown (**). Texto plano. " +
          "PRECIOS OPTIMISTAS (critico): priceLow minimo 15% sobre costo, priceMid 28-30%, priceHigh 45-55%. Nunca acercarse al costo. " +
          "Emojis solo en encabezados de seccion dentro del cuerpo, nunca en titulo. Evita frases vacias como 'Descubre', 'perfecto para tu espacio', 'combina rendimiento y diseno'. " +
          "Nunca unknown. \\n\\n entre secciones.",
      },
      { role: "user", content: parts },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI no devolvio contenido.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI devolvio JSON invalido.");
  }

  const normalized = normalizePublicationListingResult(parsed);
  const priced = enforcePublicationPriceRules(normalized, cost);
  return clampListingCopyForChannel(priced, channelCode);
}
