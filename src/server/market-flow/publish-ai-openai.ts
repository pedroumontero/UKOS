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

  const costLine =
    cost != null && Number.isFinite(cost)
      ? `Costo interno de la unidad (no mostrar al comprador): ${cost}. El precio sugerido BAJO debe ser ESTRICTAMENTE MAYOR que este costo (nunca igual ni menor). Deja margen comercial razonable.`
      : "No se indico costo en inventario; propone precios coherentes con el mercado de reventa/refurb.";

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
    `Separador entre espanol e ingles: una sola linea con solo ---------- (obligatorio). Nunca uses la linea '🇺🇸 English' ni la palabra English sola como separador.\n` +
    `Titulo: sin emojis bajo ningun concepto.\n` +
    `Propone priceHigh, priceMid, priceLow (solo numeros en JSON). Orden: priceHigh >= priceMid >= priceLow.\n` +
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
          "Anuncios de tecnologia segunda mano/refurb para marketplaces en USA. " +
          "listingTitle: NUNCA emojis ni pictogramas — solo texto. " +
          "listingDescription: espanol completo, linea separadora exacta ---------- (10 guiones), linea en blanco, ingles completo. " +
          "Nunca uses '🇺🇸 English' ni banderas como separador. Sin markdown (**). Texto plano. " +
          "Emojis solo dentro del cuerpo de la descripcion (encabezados de seccion), nunca en el titulo. " +
          "Evita slogans vacios ('Descubre', 'perfecto para tu espacio'). " +
          "Nunca unknown. Precios numericos en JSON. Si hay costo, priceLow > costo. " +
          "\\n\\n entre secciones en listingDescription.",
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
