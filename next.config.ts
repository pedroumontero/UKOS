import type { NextConfig } from "next";

import { INVENTORY_SERVER_ACTION_BODY_SIZE_MB } from "./lib-upload-limits";

// NextAuth lee NEXTAUTH_URL en el bundle de `next-auth/react`; si no está definido en el cliente,
// varias URLs absolutas pierden el puerto (p. ej. :3001) y el login por credenciales falla en dev remoto.
const nextAuthUrlForClient = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_NEXTAUTH_URL;

const isDev = process.env.NODE_ENV === "development";
const dockerPolling = Boolean(process.env.WATCHPACK_POLLING || process.env.CHOKIDAR_USEPOLLING);

const nextConfig: NextConfig = {
  ...(nextAuthUrlForClient ? { env: { NEXTAUTH_URL: nextAuthUrlForClient } } : {}),
  /** Menos recompilaciones al volver a rutas ya visitadas (por defecto Next solo guarda ~5). */
  onDemandEntries: isDev
    ? {
        maxInactiveAge: 5 * 60 * 1000,
        pagesBufferLength: 30,
      }
    : undefined,
  /** Con bind mount + polling, intervalos cortos disparan muchos “Compiling…”. */
  watchOptions: dockerPolling
    ? { pollIntervalMs: Math.max(500, Number(process.env.UKOS_DEV_POLL_MS || 1500)) }
    : undefined,
  /**
   * Solo `next dev` (NODE_ENV=development). Evita que el navegador cachee HTML/RSC y muestre copy vieja tras guardar.
   * `next build` / `next start` (PROD) evalúan esto con NODE_ENV=production → sin headers extra.
   */
  async headers() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }],
      },
    ];
  },
  // Dev: permitir /_next/* (chunks, HMR) cuando el navegador envía Origin desde estos hosts.
  // Sin el hostname Tailscale, Next dev responde 403 a los chunks y el cliente queda roto (login incluido).
  allowedDevOrigins: [
    "ukos.com",
    "dev-ukos.tech",
    "localhost",
    "127.0.0.1",
    "ukey-core-01.tailcb8c3f.ts.net",
    "100.71.178.53",
    "192.168.50.110",
  ],
  // Inventario (y otras acciones con FormData pesado): alinear con `upload-limits.ts`.
  experimental: {
    serverActions: {
      bodySizeLimit: `${INVENTORY_SERVER_ACTION_BODY_SIZE_MB}mb`,
    },
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
