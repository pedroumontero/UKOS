import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  KeyRound,
  LayoutDashboard,
  LayoutList,
  Megaphone,
  MessageSquareText,
  Settings2,
  Shield,
  Store,
  Users,
} from "lucide-react";

import type { AccessKey } from "@/lib/access-catalog";

export type UkosNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  accessKey: AccessKey;
};

export type UkosNavGroup = {
  title: string;
  href: string;
  icon: LucideIcon;
  accessKey: AccessKey;
  items?: UkosNavItem[];
};

export const ukosNavigation: UkosNavGroup[] = [
  {
    title: "Dashboard General",
    href: "/dashboard",
    icon: LayoutDashboard,
    accessKey: "general.dashboard.view",
  },
  {
    title: "Market Flow",
    href: "/market-flow/dashboard",
    icon: Store,
    accessKey: "market_flow.section.view",
    items: [
      {
        title: "Dashboard",
        href: "/market-flow/dashboard",
        icon: BarChart3,
        accessKey: "market_flow.dashboard.view",
      },
      {
        title: "Inventario",
        href: "/market-flow/inventario",
        icon: Boxes,
        accessKey: "market_flow.inventory.view",
      },
      {
        title: "Publicar",
        href: "/market-flow/publicar",
        icon: Megaphone,
        accessKey: "market_flow.publish.view",
      },
      {
        title: "Leads",
        href: "/market-flow/leads",
        icon: MessageSquareText,
        accessKey: "market_flow.leads.view",
      },
      {
        title: "Configuraciones",
        href: "/market-flow/configuraciones",
        icon: Settings2,
        accessKey: "market_flow.settings.view",
      },
    ],
  },
];

export const ukosSystemNavigationGroup: UkosNavGroup = {
  title: "Configuracion del sistema",
  href: "/system/users",
  icon: Shield,
  accessKey: "tenant.system.nav.view",
  items: [
    { title: "Usuarios", href: "/system/users", icon: Users, accessKey: "tenant.users.view" },
    { title: "Roles", href: "/system/roles", icon: Shield, accessKey: "tenant.roles.view" },
    { title: "Accesos", href: "/system/access", icon: KeyRound, accessKey: "tenant.access.catalog_view" },
  ],
};

/** Solo Super Admin global (User.role). No usa catalogo de accesos del tenant. */
export const ukosSuperAdminNavItem = {
  title: "Modulos por empresa",
  href: "/super/company-modules",
  icon: LayoutList,
} as const;

/** True si la ruta actual pertenece al grupo (para expandir el modulo en el sidebar). */
export function isPathInNavGroup(pathname: string, group: UkosNavGroup): boolean {
  if (!group.items?.length) {
    return pathname === group.href || pathname.startsWith(`${group.href}/`);
  }
  const parts = group.href.split("/").filter(Boolean);
  const root = parts.length ? `/${parts[0]}` : group.href;
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function filterNavigationForAccess(groups: UkosNavGroup[], granted: Set<string>): UkosNavGroup[] {
  const out: UkosNavGroup[] = [];
  for (const group of groups) {
    if (!group.items) {
      if (granted.has(group.accessKey)) {
        out.push(group);
      }
      continue;
    }
    const items = group.items.filter((item) => granted.has(item.accessKey));
    if (!granted.has(group.accessKey) || items.length === 0) {
      continue;
    }
    out.push({
      ...group,
      items,
      href: items[0]!.href,
    });
  }
  return out;
}
