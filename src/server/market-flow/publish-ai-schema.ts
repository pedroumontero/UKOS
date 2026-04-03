function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

/** listingTitle: prohibido emojis (regla de negocio). */
function stripEmojisFromTitle(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\|\s*/g, " | ")
    .trim();
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

export type PublicationListingAiResult = {
  listingTitle: string;
  listingDescription: string;
  priceHigh: number | null;
  priceMid: number | null;
  priceLow: number | null;
};

/** Limites orientativos (Meta Help ~200 titulo Marketplace; movil trunca antes). */
const TITLE_MAX_BY_CHANNEL: Record<string, number> = {
  facebook_marketplace: 200,
  ebay: 80,
  offerup: 100,
};

const DESCRIPTION_MAX_CHARS = 5000;

function truncateUnicode(text: string, maxChars: number, ellipsis = false): string {
  const chars = [...text];
  if (chars.length <= maxChars) return text;
  const cut = ellipsis ? Math.max(0, maxChars - 1) : maxChars;
  const base = chars.slice(0, cut).join("");
  return ellipsis ? `${base}…` : base;
}

/** Recorta titulo/descripcion si el modelo se pasa del limite del canal. */
export function clampListingCopyForChannel(
  data: PublicationListingAiResult,
  channelCode: string,
): PublicationListingAiResult {
  const titleMax = TITLE_MAX_BY_CHANNEL[channelCode] ?? 200;
  const titleClean = stripEmojisFromTitle(data.listingTitle.trim());
  return {
    ...data,
    listingTitle: truncateUnicode(titleClean, titleMax, true),
    listingDescription: truncateUnicode(data.listingDescription, DESCRIPTION_MAX_CHARS, false),
  };
}

const BILINGUAL_SEPARATOR = "----------";

/** Limpia descripcion al guardar (separador, **, 🇺🇸 English). */
export function sanitizePublicationDescription(text: string): string {
  return descriptionStr(text);
}

/** Quita emojis del titulo al guardar. */
export function sanitizePublicationTitle(text: string): string {
  return stripEmojisFromTitle(text.trim());
}

function descriptionStr(v: unknown): string {
  let s = v == null ? "" : typeof v === "string" ? v : String(v);
  s = s.replace(/\\n/g, "\n");
  // Markdown: quitar ** (negritas); Marketplace es texto plano
  s = s.replace(/\*\*+/g, "");
  // Separador ES | EN: nunca "🇺🇸 English" (modelo a veces lo ignora)
  s = s.replace(/^\s*🇺🇸\s*English\s*$/gim, BILINGUAL_SEPARATOR);
  s = s.replace(/🇺🇸\s*English/gi, BILINGUAL_SEPARATOR);
  s = s.replace(/\s*🇺🇸\s*/g, " ");
  s = s.replace(/(\n----------\n){2,}/g, `\n${BILINGUAL_SEPARATOR}\n`);
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizePublicationListingResult(raw: unknown): PublicationListingAiResult {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    listingTitle: stripEmojisFromTitle(str(o.listingTitle)),
    listingDescription: descriptionStr(o.listingDescription),
    priceHigh: num(o.priceHigh),
    priceMid: num(o.priceMid),
    priceLow: num(o.priceLow),
  };
}

/** Orden high >= mid >= low; precio bajo estrictamente mayor que costo cuando hay costo. */
export function enforcePublicationPriceRules(
  data: PublicationListingAiResult,
  cost: number | null,
): PublicationListingAiResult {
  let h = data.priceHigh;
  let m = data.priceMid;
  let l = data.priceLow;

  const arr = [h, m, l].filter((v): v is number => v != null && Number.isFinite(v));
  if (arr.length === 0) {
    return data;
  }

  if (arr.length === 1) {
    const v = arr[0]!;
    l = m = h = v;
  } else if (arr.length === 2) {
    const [a, b] = [...arr].sort((x, y) => x - y);
    l = a;
    h = b;
    m = Math.round(((a + b) / 2) * 100) / 100;
  } else {
    [l, m, h] = [...arr].sort((x, y) => x - y);
  }

  const minAboveCost =
    cost != null && Number.isFinite(cost) && cost > 0 ? Math.ceil(cost * 1.05 * 100) / 100 : null;

  if (minAboveCost != null && cost != null) {
    if (l <= cost) {
      l = minAboveCost;
    }
    if (m < l) {
      m = l;
    }
    if (h < m) {
      h = m;
    }
    if (h <= m) {
      h = Math.ceil((m + Math.max(m * 0.08, 5)) * 100) / 100;
    }
    if (m <= l && h > l) {
      m = Math.round(((l + h) / 2) * 100) / 100;
      if (m < l) {
        m = l;
      }
    }
  } else {
    if (m < l) {
      m = l;
    }
    if (h < m) {
      h = m;
    }
  }

  return {
    ...data,
    priceLow: l,
    priceMid: m,
    priceHigh: h,
  };
}
