import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getCurrentSession } from "@/server/auth";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session?.user?.id) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(180,180,180,0.12),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(247,247,246,1)_100%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(110,110,110,0.18),_transparent_38%),linear-gradient(180deg,_rgba(15,15,15,1)_0%,_rgba(9,9,11,1)_100%)]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center gap-12 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden lg:block">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold tracking-tight text-muted-foreground backdrop-blur">
              Plataforma modular para operar y crecer
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold tracking-tight text-foreground">UKOS + Market Flow</h1>
              <p className="text-lg leading-8 text-muted-foreground">
                Centraliza administración, CRM, ventas, inventario y punto de venta en módulos que puedes activar según tu etapa. Control operativo real, sin la rigidez de un ERP tradicional ni herramientas sueltas que no conversan entre sí.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                "Multiempresa con cambio de contexto al instante",
                "Interfaz clara u oscura para cualquier entorno",
                "Inventario preciso por unidad",
                "Canales, publicar y leads en un solo flujo",
              ].map((item) => (
                <div key={item} className="rounded-[1.75rem] border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur">
                  <p className="font-medium text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-[2rem] bg-muted/40" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
