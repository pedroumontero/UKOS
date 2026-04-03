"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, ChevronRight, Shield } from "lucide-react";

import { useNavAccess } from "@/components/nav-access-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { Separator } from "@/components/ui/separator";
import { useNavModuleExpand } from "@/hooks/use-nav-module-expand";
import {
  filterNavigationForAccess,
  isPathInNavGroup,
  ukosNavigation,
  ukosSuperAdminNavItem,
  ukosSystemNavigationGroup,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  companyName: string;
  userName: string;
};

export function UkosSidebar({ companyName, userName }: SidebarProps) {
  const pathname = usePathname();
  const { grantedKeys, isSuperAdmin } = useNavAccess();
  const SuperIcon = ukosSuperAdminNavItem.icon;
  const navGroups = React.useMemo(
    () => filterNavigationForAccess([...ukosNavigation, ukosSystemNavigationGroup], grantedKeys),
    [grantedKeys],
  );

  const { moduleOpen, toggleModule } = useNavModuleExpand(navGroups, pathname);
  const showDebugAttrs = process.env.NEXT_PUBLIC_UKOS_DEBUG_SIDEBAR === "true";
  const showBuildStamp = process.env.NEXT_PUBLIC_UKOS_SHOW_BUILD_STAMP === "true";
  const buildId = process.env.NEXT_PUBLIC_UKOS_BUILD ?? "";

  return (
    <aside
      {...(showDebugAttrs ? { "data-ukos-sidebar-debug": "1" } : {})}
      className="flex h-full flex-col border-r border-border/70 bg-sidebar/95 px-4 py-5 backdrop-blur"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">UKOS</p>
        {isSuperAdmin ? (
          <div className="rounded-3xl border border-amber-500/35 bg-amber-500/10 p-4 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-950 dark:text-amber-100">
                <Shield className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Panel global</p>
                <p className="text-xs text-muted-foreground">Administración multi-empresa</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={cn("rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm", isSuperAdmin ? "mt-4" : "mt-5")}>
        <div className="flex items-center gap-3" title={companyName}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{companyName}</p>
            <p className="text-xs text-muted-foreground">Empresa activa</p>
          </div>
        </div>
      </div>

      <nav className="mt-6 flex w-full flex-1 flex-col space-y-6 overflow-y-auto">
        {isSuperAdmin ? (
          <div className="space-y-2">
            <Link
              href={ukosSuperAdminNavItem.href}
              className={cn(
                "flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-950 transition-colors dark:text-amber-100",
                pathname.startsWith("/super")
                  ? "border-amber-600 bg-amber-500/20"
                  : "hover:bg-amber-500/15",
              )}
            >
              <SuperIcon className="size-4 shrink-0" />
              <span>{ukosSuperAdminNavItem.title}</span>
            </Link>
          </div>
        ) : null}
        {navGroups.map((group) => {
          const GroupIcon = group.icon;

          if (!group.items?.length) {
            return (
              <div key={group.title} className="space-y-2">
                <Link
                  href={group.href}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                    pathname === group.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <GroupIcon className="size-4 shrink-0" />
                  <span>{group.title}</span>
                </Link>
              </div>
            );
          }

          const open = moduleOpen[group.title] ?? false;
          const moduleActive = isPathInNavGroup(pathname, group);
          const slug = group.title.replace(/\s+/g, "-");

          return (
            <div key={group.title} className="space-y-2">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? `nav-module-${slug}` : undefined}
                id={`nav-module-trigger-${slug}`}
                title={open ? `Ocultar opciones de ${group.title}` : `Mostrar opciones de ${group.title}`}
                onClick={() => toggleModule(group.title)}
                className={cn(
                  "flex w-full min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-[background-color,border-color,box-shadow] duration-200",
                  open
                    ? "border-border/60 bg-muted/40 shadow-sm"
                    : "border-border/30 bg-transparent hover:border-border/60 hover:bg-muted/25",
                  moduleActive && "ring-1 ring-primary/25",
                )}
              >
                <GroupIcon className="size-4 shrink-0 text-foreground" />
                <span className="min-w-0 flex-1 text-foreground">{group.title}</span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-foreground">
                  {open ? (
                    <ChevronDown className="size-5" strokeWidth={2.25} aria-hidden />
                  ) : (
                    <ChevronRight className="size-5" strokeWidth={2.25} aria-hidden />
                  )}
                </span>
              </button>
              {open ? (
                <div
                  id={`nav-module-${slug}`}
                  role="region"
                  aria-labelledby={`nav-module-trigger-${slug}`}
                  className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200 border-l-2 border-primary/30 pl-3"
                >
                  <ul className="space-y-1 py-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-accent font-medium text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span>{item.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <Separator className="my-4" />

      <div className="space-y-3">
        {showBuildStamp && buildId ? (
          <p className="px-1 text-[10px] leading-tight text-muted-foreground/60" title="Identificador de build (solo con UKOS_SHOW_BUILD_STAMP=true al construir)">
            Build {buildId}
          </p>
        ) : null}
        <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
          <p className="text-sm font-medium text-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground">Sesión activa</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
