import Link from "next/link";

import { getEffectiveAccessSet, requireTenantSystemAccess } from "@/server/tenant-authorization";
import { cn } from "@/lib/utils";

const tabDefs = [
  { href: "/system/users", label: "Usuarios", key: "tenant.users.view" as const },
  { href: "/system/roles", label: "Roles", key: "tenant.roles.view" as const },
  { href: "/system/access", label: "Accesos", key: "tenant.access.catalog_view" as const },
];

export default async function SystemTenantLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantSystemAccess();
  const access = await getEffectiveAccessSet(
    session.user.id,
    session.user.activeCompanyId,
    session.user.role,
  );
  const tabs = tabDefs.filter((t) => access.has(t.key));

  return (
    <div className="min-w-0">
      <nav
        className="flex flex-wrap gap-2 border-b border-border/60 px-4 py-3 text-sm lg:px-8"
        aria-label="Configuracion del sistema"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-xl px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
