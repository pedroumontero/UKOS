import type { NextConfig } from "next";

// NextAuth lee NEXTAUTH_URL en el bundle de `next-auth/react`; si no está definido en el cliente,
// varias URLs absolutas pierden el puerto (p. ej. :3001) y el login por credenciales falla en dev remoto.
const nextAuthUrlForClient = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_NEXTAUTH_URL;

const nextConfig: NextConfig = {
  ...(nextAuthUrlForClient ? { env: { NEXTAUTH_URL: nextAuthUrlForClient } } : {}),
  // Dev: permitir /_next/* (chunks, HMR) cuando el navegador envía Origin desde estos hosts.
  // Sin el hostname Tailscale, Next dev responde 403 a los chunks y el cliente queda roto (login incluido).
  allowedDevOrigins: [
    "ukos.com",
    "dev-ukos.tech",
    "ukey-core-01.tailcb8c3f.ts.net",
    "100.71.178.53",
  ],
  // Inventario sube fotos por Server Action; el límite por defecto es 1 MB y rompe el flujo con imágenes reales.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
