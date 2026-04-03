import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import {
  ALL_ACCESS_KEYS,
  DEFAULT_OPERATOR_MARKET_FLOW_KEYS,
  DEFAULT_TENANT_ADMIN_ACCESS_KEYS,
  getAccessEntry,
  isAccessKey,
  type AccessKey,
} from "@/lib/access-catalog";
import { requireSession } from "@/server/auth";
import { db } from "@/server/db";

function fallbackAccessForLegacyRole(role: string): Set<string> {
  if (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) {
    return new Set(DEFAULT_TENANT_ADMIN_ACCESS_KEYS);
  }
  if (role === UserRole.OPERATOR) {
    return new Set<string>(["general.dashboard.view", ...DEFAULT_OPERATOR_MARKET_FLOW_KEYS]);
  }
  return new Set();
}

/**
 * Prioridad:
 * 1) Modulo requerido no habilitado -> denegar (excepto SUPERADMIN global: bypass total)
 * 2) Override DENY -> denegar
 * 3) Override ALLOW -> permitir
 * 4) Permiso en rol -> permitir
 * 5) Sin membresia -> fallback por User.role legacy
 * 6) Denegar
 */
export async function getEffectiveAccessSet(
  userId: string,
  companyId: string,
  legacyRole: string,
): Promise<Set<string>> {
  if (legacyRole === UserRole.SUPERADMIN) {
    return new Set(ALL_ACCESS_KEYS);
  }

  const [modules, overrides, membership] = await Promise.all([
    db.companyModule.findMany({
      where: { companyId, isEnabled: true },
      select: { moduleKey: true },
    }),
    db.companyUserAccessOverride.findMany({
      where: { userId, companyId },
    }),
    db.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: {
        companyRole: { include: { permissions: true } },
      },
    }),
  ]);

  const enabledModules = new Set(modules.map((m) => m.moduleKey));
  const overrideByKey = new Map(overrides.map((o) => [o.accessKey, o.effect]));

  const roleKeys = membership
    ? new Set(
        membership.companyRole.permissions.map((p) => p.permissionKey).filter((k) => isAccessKey(k)),
      )
    : fallbackAccessForLegacyRole(legacyRole);

  const granted = new Set<string>();

  for (const key of ALL_ACCESS_KEYS) {
    const entry = getAccessEntry(key);
    if (
      entry &&
      "requiresModule" in entry &&
      entry.requiresModule &&
      !enabledModules.has(entry.requiresModule)
    ) {
      continue;
    }

    const ov = overrideByKey.get(key);
    if (ov === "DENY") {
      continue;
    }
    if (ov === "ALLOW") {
      granted.add(key);
      continue;
    }
    if (roleKeys.has(key)) {
      granted.add(key);
    }
  }

  return granted;
}

export async function userHasAccess(
  userId: string,
  companyId: string,
  legacyRole: string,
  key: AccessKey,
): Promise<boolean> {
  const set = await getEffectiveAccessSet(userId, companyId, legacyRole);
  return set.has(key);
}

export async function requireAccess(key: AccessKey) {
  const session = await requireSession();
  const ok = await userHasAccess(session.user.id, session.user.activeCompanyId, session.user.role, key);
  if (!ok) {
    // Nunca redirigir a la misma ruta que puede volver a exigir este acceso (provocaba ERR_TOO_MANY_REDIRECTS).
    redirect("/sin-acceso");
  }
  return session;
}
