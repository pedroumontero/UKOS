"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";

import { useAppTheme } from "@/components/app-providers";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useAppTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="rounded-full">
        <SunMedium className="size-4" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full border-border/70 bg-card/80 shadow-sm backdrop-blur"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <SunMedium className="size-4" /> : <MoonStar className="size-4" />}
      <span className="sr-only">Cambiar Tema</span>
    </Button>
  );
}
