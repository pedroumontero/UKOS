import { requireAccess } from "@/server/access-resolution";

export { getEffectiveAccessSet, requireAccess, userHasAccess } from "@/server/access-resolution";

/** Entrar a /system/* (admin de empresa). */
export async function requireTenantSystemAccess() {
  return requireAccess("tenant.system.nav.view");
}
