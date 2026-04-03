import OpenAI from "openai";

import {
  inventoryVisionJsonSchemaHint,
  normalizeInventoryVisionResult,
  type InventoryVisionResult,
} from "@/server/market-flow/inventory-ai-schema";

export type ImagePart = { base64: string; mimeType: string };

function buildUserContent(
  images: ImagePart[],
  industryType: string,
  userContext: string,
  formHints: Record<string, string>,
) {
  const blocks: string[] = [];

  blocks.push(
    `Analiza estas fotos de inventario de hardware/tecnologia (reventa o refurb). ` +
      `Rubro del negocio configurado: "${industryType}".`,
  );

  if (userContext.trim()) {
    blocks.push(
      `--- Contexto escrito por el operador (usalo como pista fuerte junto con la imagen; puede ser incompleto o equivocado: contrasta con lo visible) ---\n${userContext.trim()}`,
    );
  }

  const hintEntries = Object.entries(formHints).filter(([, v]) => v.trim());
  if (hintEntries.length) {
    blocks.push(
      `--- Campos que el operador ya empezo a rellenar en el formulario (apoyo; la foto manda si hay contradiccion clara) ---\n` +
        hintEntries.map(([k, v]) => `${k}: ${v}`).join("\n"),
    );
  }

  blocks.push(
    `Responde SOLO con un unico objeto JSON valido (sin markdown, sin comentarios) con exactamente estas claves y valores string. ` +
      `Si el operador o el formulario ya indicaron marca, modelo, specs o condicion, incorporalos en los campos correspondientes cuando encajen con la imagen. ` +
      `No uses valores inutiles como "unknown", "N/A" o "desconocido": usa cadena vacia "" cuando no haya dato fiable. ` +
      `No inventes numeros de serie ni datos que no se vean ni se deduzcan con razonable seguridad.\n` +
      inventoryVisionJsonSchemaHint,
  );

  const intro = blocks.join("\n\n");

  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: intro }];

  for (const img of images) {
    const mime = img.mimeType || "image/jpeg";
    parts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${img.base64}`, detail: "auto" },
    });
  }

  return parts;
}

export async function runInventoryVisionAnalysis(params: {
  apiKey: string;
  model: string;
  images: ImagePart[];
  industryType: string;
  userContext?: string;
  formHints?: Record<string, string>;
}): Promise<InventoryVisionResult> {
  const { apiKey, model, images, industryType, userContext = "", formHints = {} } = params;

  if (!images.length) {
    throw new Error("No hay imagenes para analizar.");
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 1400,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Eres un experto en catalogacion de inventario tecnologico. " +
          "Prioriza: (1) lo que se ve en las fotos, (2) el contexto escrito por el operador, (3) los campos que ya tenia el formulario. " +
          "Si el operador indico marca y modelo concretos, deben aparecer en brand/model/titulo salvo que la imagen los contradiga de forma evidente. " +
          "Se conservador con datos no confirmados: cadena vacia en lugar de suposiciones debiles. " +
          "Nunca devuelvas la palabra 'unknown' ni equivalentes inutiles. " +
          "Responde unicamente JSON valido.",
      },
      {
        role: "user",
        content: buildUserContent(images, industryType, userContext, formHints),
      },
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

  return normalizeInventoryVisionResult(parsed);
}
