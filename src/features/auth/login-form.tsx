"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Lee callbackUrl solo en el cliente (submit), evita useSearchParams y errores de hidratación. */
function callbackPathFromLocationSearch(search: string) {
  const raw = new URLSearchParams(search).get("callbackUrl");
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  if (raw?.startsWith("http")) {
    try {
      const parsed = new URL(raw);
      if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/dashboard";
      }
    } catch {
      /* ignore */
    }
  }
  return "/dashboard";
}

/** NextAuth puede devolver HTTP 200 con { url } apuntando a error/csrf; `ok` sigue siendo true. */
function isCredentialSignInFailure(url: string | null | undefined) {
  if (!url) return false;
  return (
    url.includes("CredentialsSignin") ||
    url.includes("csrf=true") ||
    url.includes("/api/auth/error") ||
    (url.includes("/api/auth/signin") && url.includes("csrf"))
  );
}

export function LoginForm() {
  const [pending, startTransition] = React.useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const path = callbackPathFromLocationSearch(window.location.search);
      const callbackUrl = `${window.location.origin}${path}`;

      const result = await signIn("credentials", {
        redirect: false,
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        callbackUrl,
      });

      if (!result?.ok || isCredentialSignInFailure(result.url)) {
        toast.error("No fue posible iniciar sesion. Revisa tus credenciales o recarga la pagina.");
        return;
      }

      // Navegacion completa evita bucles RSC/HMR entre SessionProvider y soft navigation + refresh.
      window.location.assign(path);
    });
  }

  return (
    <Card className="w-full rounded-[2rem] border-border/70 bg-card/95 shadow-2xl shadow-black/5">
      <CardHeader className="space-y-3 pb-2">
        <div className="inline-flex w-fit rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-semibold tracking-tight text-muted-foreground">
          UKOS
        </div>
        <CardTitle className="text-2xl tracking-tight">Entrar a tu espacio operativo</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Sin method="post": un POST nativo a /login (JS lento/off) rompe el App Router (JSON.parse vacío → 500). */}
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue="admin@ukos.local" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" defaultValue="admin123" required />
          </div>
          <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Ingresar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
