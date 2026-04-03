#!/usr/bin/env node
/**
 * Audita el shell protegido REAL en una URL base (p. ej. https://ukos.com):
 * login NextAuth + GET /dashboard + busca marcador del sidebar en HTML y chunks JS.
 *
 * Uso:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 UKOS_BASE_URL=https://ukos.com \
 *   UKOS_EMAIL=admin@ukos.local UKOS_PASSWORD=admin123 node scripts/audit-protected-bundle.mjs
 */
/* eslint-disable no-console */

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

const BASE = (process.env.UKOS_BASE_URL || "https://ukos.com").replace(/\/$/, "");
const EMAIL = process.env.UKOS_EMAIL || "admin@ukos.local";
const PASSWORD = process.env.UKOS_PASSWORD || "admin123";
const MARKER = "ukos-sidebar-module-v3";
const LEGACY_SIDEBAR = "Contraer menu";
const STORAGE_KEY = "ukos.sidebar.moduleExpand.v3";

function parseCookies(setCookie) {
  if (!setCookie) return [];
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.map((c) => c.split(";")[0].trim()).filter(Boolean);
}

function mergeCookieHeader(existing, pairs) {
  const map = new Map();
  if (existing) {
    for (const part of existing.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k) map.set(k, v.join("="));
    }
  }
  for (const p of pairs) {
    const [k, ...v] = p.split("=");
    if (k) map.set(k.trim(), v.join("="));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchText(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers,
    body,
    redirect: "manual",
  });
  const text = await res.text();
  return { res, text };
}

async function main() {
  console.log("BASE:", BASE);
  let cookieHeader = "";

  const csrfUrl = `${BASE}/api/auth/csrf`;
  const { res: csrfRes, text: csrfText } = await fetchText(csrfUrl);
  if (!csrfRes.ok) {
    console.error("CSRF failed", csrfRes.status, csrfText.slice(0, 200));
    process.exit(1);
  }
  const csrfJson = JSON.parse(csrfText);
  const csrfToken = csrfJson.csrfToken;
  for (const c of parseCookies(csrfRes.headers.getSetCookie?.() ?? csrfRes.headers.get("set-cookie"))) {
    cookieHeader = mergeCookieHeader(cookieHeader, [c]);
  }

  const params = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const { res: signRes, text: signText } = await fetchText(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body: params.toString(),
  });

  for (const c of parseCookies(signRes.headers.getSetCookie?.() ?? signRes.headers.get("set-cookie"))) {
    cookieHeader = mergeCookieHeader(cookieHeader, [c]);
  }

  if (signRes.status === 302 || signRes.status === 301) {
    const loc = signRes.headers.get("location");
    console.log("Sign-in redirect:", signRes.status, loc);
  } else {
    console.log("Sign-in status:", signRes.status, signText.slice(0, 400));
  }

  let dashUrl = `${BASE}/dashboard`;
  let { res: dashRes, text: dashText } = await fetchText(dashUrl, {
    headers: { Cookie: cookieHeader },
  });

  if (dashRes.status === 302 || dashRes.status === 301) {
    const loc = dashRes.headers.get("location");
    if (loc && !loc.startsWith("http")) {
      dashUrl = loc.startsWith("/") ? `${BASE}${loc}` : `${BASE}/${loc}`;
    } else if (loc) {
      dashUrl = loc;
    }
    const r2 = await fetchText(dashUrl, { headers: { Cookie: cookieHeader } });
    dashRes = r2.res;
    dashText = r2.text;
  }

  console.log("GET /dashboard final status:", dashRes.status, "bytes:", dashText.length);

  const inHtml = dashText.includes(MARKER);
  const hasLoginForm = dashText.includes("Entrar A Tu Espacio Operativo") || dashText.includes("admin@ukos.local");
  console.log("Marker in /dashboard HTML:", inHtml);
  console.log("Looks like login page (unauthenticated):", hasLoginForm && dashText.length < 40000);

  const chunkUrls = new Set();
  const re = /\/_next\/static\/chunks\/[^"'\\s>]+\.js/g;
  let m;
  while ((m = re.exec(dashText)) !== null) {
    chunkUrls.add(m[0].startsWith("/") ? `${BASE}${m[0]}` : m[0]);
  }
  console.log("Chunk URLs referenced from dashboard HTML:", chunkUrls.size);

  let foundInChunk = false;
  let foundChunkName = "";
  let legacyChunk = "";
  for (const u of chunkUrls) {
    const { res, text } = await fetchText(u);
    if (!res.ok) continue;
    if (!foundInChunk && text.includes(MARKER)) {
      foundInChunk = true;
      foundChunkName = u;
    }
    if (!legacyChunk && text.includes(LEGACY_SIDEBAR)) {
      legacyChunk = u;
    }
  }

  console.log("Marker in any dashboard-referenced chunk:", foundInChunk, foundChunkName || "");
  console.log("LEGACY sidebar chunk (Contraer menu):", legacyChunk || "(none in initial 13)");

  const summary = {
    authenticatedDashboard: dashRes.ok && !hasLoginForm,
    markerInHtml: inHtml,
    markerInReferencedChunk: foundInChunk,
    legacySidebarChunk: legacyChunk || null,
    storageKeyDocumented: STORAGE_KEY,
  };
  console.log("SUMMARY_JSON:", JSON.stringify(summary));

  if (!summary.authenticatedDashboard) {
    console.error("FAIL: no se obtuvo /dashboard autenticado (revisa credenciales, TLS, o redirect).");
    process.exit(2);
  }
  if (summary.legacySidebarChunk && !summary.markerInReferencedChunk) {
    console.error(
      "FAIL: chunk legacy del sidebar en shell autenticado (texto Contraer menu). Despliega imagen/build actual del repo.",
    );
    process.exit(4);
  }
  if (!summary.markerInReferencedChunk && !summary.markerInHtml) {
    console.error(
      "FAIL: bundle v3 no en HTML ni en los primeros chunks enlazados (puede haber carga diferida; usar Playwright para red completa).",
    );
    process.exit(3);
  }
  console.log("OK: evidencia de bundle v3 en area protegida.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
