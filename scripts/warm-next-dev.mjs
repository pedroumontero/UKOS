/**
 * Precalienta rutas pesadas de `next dev --webpack` en Docker (primera compilación ~30–90s).
 * Se lanza en segundo plano al arrancar el contenedor; hace polling hasta que Next responde.
 */
const origin = process.env.UKOS_WARM_ORIGIN ?? "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function serverUp() {
  try {
    const r = await fetch(`${origin}/login`, { redirect: "manual", signal: AbortSignal.timeout(180000) });
    return r.status === 200 || r.status === 307 || r.status === 302;
  } catch {
    return false;
  }
}

async function warmPath(path) {
  try {
    await fetch(`${origin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(240000) });
  } catch {
    /* sin sesión o timeout: igual suele disparar compilación */
  }
  await sleep(4000);
}

async function main() {
  for (let i = 0; i < 120; i++) {
    if (await serverUp()) break;
    await sleep(3000);
  }
  await sleep(5000);
  // NextAuth: primera visita suele compilar varios s; espaciar para no atascar webpack.
  await warmPath("/api/auth/providers");
  await warmPath("/api/auth/session");
  await warmPath("/api/auth/csrf");
  await warmPath("/market-flow");
  await warmPath("/market-flow/dashboard");
  await warmPath("/market-flow/inventario");
  await warmPath("/market-flow/publicar");
}

main().catch(() => {});
