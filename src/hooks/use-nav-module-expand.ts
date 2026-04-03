"use client";

import * as React from "react";

import type { UkosNavGroup } from "@/lib/navigation";
import { isPathInNavGroup } from "@/lib/navigation";

/** Cadena fija en el bundle cliente: comprobar en chunks servidos con grep/curl. */
export const UKOS_SIDEBAR_BUNDLE_MARKER = "ukos-sidebar-module-v3";

const STORAGE_KEY = "ukos.sidebar.moduleExpand.v3";

function readPrefs(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writePrefs(prefs: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

function computeOpenMap(
  prefs: Record<string, boolean>,
  pathname: string,
  navGroups: UkosNavGroup[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const g of navGroups) {
    if (!g.items?.length) continue;
    const key = g.title;
    out[key] = prefs[key] !== undefined ? prefs[key]! : isPathInNavGroup(pathname, g);
  }
  return out;
}

/**
 * Expandido/colapsado por módulo con localStorage + regla al entrar en una ruta del módulo.
 *
 * Prioridad:
 * 1. Si acabas de navegar desde fuera hacia dentro del módulo → abrir y guardar `true`.
 * 2. Si existe preferencia guardada para ese título → usarla.
 * 3. Si no hay preferencia → derivar de la ruta (solo el módulo activo abierto; en `/dashboard` ninguno).
 */
export function useNavModuleExpand(navGroups: UkosNavGroup[], pathname: string) {
  const [moduleOpen, setModuleOpen] = React.useState<Record<string, boolean>>({});
  const prevPathRef = React.useRef<string | null>(null);
  const mountedRef = React.useRef(false);

  React.useLayoutEffect(() => {
    const prefs = readPrefs();
    const prev = prevPathRef.current;

    if (!mountedRef.current) {
      mountedRef.current = true;
      setModuleOpen(computeOpenMap(prefs, pathname, navGroups));
      prevPathRef.current = pathname;
      return;
    }

    if (prev === pathname) {
      setModuleOpen(computeOpenMap(readPrefs(), pathname, navGroups));
      return;
    }

    const nextPrefs = { ...prefs };
    let prefsDirty = false;
    for (const g of navGroups) {
      if (!g.items?.length) continue;
      const wasIn = isPathInNavGroup(prev ?? "", g);
      const nowIn = isPathInNavGroup(pathname, g);
      if (!wasIn && nowIn) {
        nextPrefs[g.title] = true;
        prefsDirty = true;
      }
    }
    if (prefsDirty) {
      writePrefs(nextPrefs);
    }
    setModuleOpen(computeOpenMap(prefsDirty ? nextPrefs : readPrefs(), pathname, navGroups));
    prevPathRef.current = pathname;
  }, [pathname, navGroups]);

  const toggleModule = React.useCallback((title: string) => {
    setModuleOpen((state) => {
      const cur = state[title] ?? false;
      const nextVal = !cur;
      const prefs = readPrefs();
      prefs[title] = nextVal;
      writePrefs(prefs);
      return { ...state, [title]: nextVal };
    });
  }, []);

  return { moduleOpen, toggleModule, bundleMarker: UKOS_SIDEBAR_BUNDLE_MARKER };
}
