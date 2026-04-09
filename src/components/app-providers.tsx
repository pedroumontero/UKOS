"use client";

import * as React from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useAppTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within AppProviders");
  }

  return context;
}

export function AppProviders({
  children,
  session,
}: {
  children: React.ReactNode;
  /** Sesión del servidor: evita el primer fetch a /api/auth/session (menos “Failed to fetch” en dev lento). */
  session?: Session | null;
}) {
  const [theme, setThemeState] = React.useState<ThemeMode>("light");

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem("ukos-theme");
    const nextTheme: ThemeMode = storedTheme === "dark" ? "dark" : "light";

    setThemeState(nextTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(nextTheme);
  }, []);

  const setTheme = React.useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    window.localStorage.setItem("ukos-theme", nextTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(nextTheme);
  }, []);

  return (
    <SessionProvider
      session={session ?? undefined}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors closeButton position="top-right" />
      </ThemeContext.Provider>
    </SessionProvider>
  );
}
