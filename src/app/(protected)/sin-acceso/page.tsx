import Link from "next/link";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { getAppContext } from "@/server/app-context";
import { cn } from "@/lib/utils";

/** Destino seguro cuando falta un acceso concreto; no debe llamar a requireAccess de nuevo. */
export default async function SinAccesoPage() {
  const { company } = await getAppContext();

  return (
    <ProtectedPageShell
      companyName={company.name}
      title="Sin acceso"
      description="Tu cuenta no tiene permiso para abrir la seccion que pediste, o tu rol aun no tiene accesos configurados."
    >
      <div className="max-w-lg space-y-4 text-sm text-muted-foreground">
        <p>
          Si acabas de crear la empresa o el rol, pide a un administrador que revise los accesos en{" "}
          <span className="font-medium text-foreground">Configuracion del sistema → Roles</span>.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl no-underline")}
          >
            Ir al inicio
          </Link>
          <SignOutButton />
        </div>
      </div>
    </ProtectedPageShell>
  );
}
