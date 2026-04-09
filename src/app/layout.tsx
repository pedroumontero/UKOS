import type { Metadata } from "next";
import { headers } from "next/headers";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import { getCurrentSession } from "@/server/auth";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  const isDevSurface =
    host.includes("dev-ukos.tech") || process.env.NODE_ENV === "development";

  return {
    title: isDevSurface ? "dev - UKOS" : "UKOS",
    description: "Sistema Madre Modular Para Operacion Comercial Premium",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentSession();

  return (
    <html lang="es" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AppProviders session={session}>{children}</AppProviders>
      </body>
    </html>
  );
}
