"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Menu } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNavAccess } from "@/components/nav-access-shell";
import { useNavModuleExpand } from "@/hooks/use-nav-module-expand";
import {
  filterNavigationForAccess,
  isPathInNavGroup,
  ukosNavigation,
  ukosSuperAdminNavItem,
  ukosSystemNavigationGroup,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  companyName: string;
};

export function UkosMobileNav({ companyName }: MobileNavProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const { grantedKeys, isSuperAdmin } = useNavAccess();
  const SuperIcon = ukosSuperAdminNavItem.icon;
  const navGroups = React.useMemo(
    () => filterNavigationForAccess([...ukosNavigation, ukosSystemNavigationGroup], grantedKeys),
    [grantedKeys],
  );

  const { moduleOpen, toggleModule } = useNavModuleExpand(navGroups, pathname);
  const showDebugAttrs = process.env.NEXT_PUBLIC_UKOS_DEBUG_SIDEBAR === "true";

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <Button variant="outline" size="icon" className="rounded-full border-border/70 bg-card/80" onClick={() => setSheetOpen(true)}>
        <Menu className="size-4" />
        <span className="sr-only">Abrir Navegacion</span>
      </Button>
      <SheetContent
        side="left"
        {...(showDebugAttrs ? { "data-ukos-sidebar-debug": "1" } : {})}
        className="w-[88vw] max-w-sm rounded-r-3xl border-border/60 bg-background/95 px-0"
      >
        <SheetHeader className="border-b border-border/60 px-5 pb-4 text-left">
          <SheetTitle>UKOS</SheetTitle>
          <SheetDescription className="text-left">
            <span className="block font-medium text-foreground">{companyName}</span>
            <span className="mt-1 block text-xs text-muted-foreground">Empresa activa</span>
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-5 py-5">
          {isSuperAdmin ? (
            <div className="space-y-2">
              <Link
                href={ukosSuperAdminNavItem.href}
                onClick={() => setSheetOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-950 dark:text-amber-100",
                  pathname.startsWith("/super") ? "border-amber-600 bg-amber-500/20" : "",
                )}
              >
                <SuperIcon className="size-4 shrink-0" />
                {ukosSuperAdminNavItem.title}
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
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium",
                      pathname === group.href
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <GroupIcon className="size-4 shrink-0" />
                    {group.title}
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
                  aria-controls={open ? `m-nav-module-${slug}` : undefined}
                  id={`m-nav-module-trigger-${slug}`}
                  title={open ? `Ocultar opciones de ${group.title}` : `Mostrar opciones de ${group.title}`}
                  onClick={() => toggleModule(group.title)}
                  className={cn(
                    "flex w-full min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-[background-color,border-color] duration-200",
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
                    id={`m-nav-module-${slug}`}
                    role="region"
                    aria-labelledby={`m-nav-module-trigger-${slug}`}
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
                              onClick={() => setSheetOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                                isActive
                                  ? "bg-accent font-medium text-accent-foreground"
                                  : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
                              )}
                            >
                              <Icon className="size-4" />
                              {item.title}
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
          <div className="pt-2">
            <SignOutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
