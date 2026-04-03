import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Delegados minimos que debe exponer el cliente generado. Si faltan, el binario de Prisma
 * no corresponde al schema (o no se ejecuto `prisma generate` / `node_modules` esta roto).
 */
const REQUIRED_DELEGATES = [
  "companyModule",
  "companyMembership",
  "companyUserAccessOverride",
] as const;

function prismaDelegateHasFindMany(client: unknown, name: string): boolean {
  const delegate = (client as Record<string, unknown>)[name];
  return (
    delegate != null &&
    typeof delegate === "object" &&
    typeof (delegate as { findMany?: unknown }).findMany === "function"
  );
}

function prismaClientIsComplete(client: PrismaClient): boolean {
  return REQUIRED_DELEGATES.every((name) => prismaDelegateHasFindMany(client, name));
}

function missingDelegates(client: PrismaClient): string[] {
  return REQUIRED_DELEGATES.filter((name) => !prismaDelegateHasFindMany(client, name));
}

function createPrismaClient(): PrismaClient {
  const instance = new PrismaClient();
  const missing = missingDelegates(instance);
  if (missing.length > 0) {
    throw new Error(
      `[ukos/db] Prisma Client sin modelos requeridos: ${missing.join(", ")}. ` +
        "Ejecuta `npx prisma generate` y reinicia el proceso. " +
        "En Docker Compose, el volumen en /app/node_modules requiere `npm install` antes de generar; revisa el `command` del servicio app.",
    );
  }
  return instance;
}

/**
 * Tras cambiar el schema, un PrismaClient viejo en global (HMR / proceso largo) no trae
 * delegados nuevos. Invalidamos si el cliente cacheado no pasa la comprobacion completa.
 */
function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && !prismaClientIsComplete(cached)) {
    void cached.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
