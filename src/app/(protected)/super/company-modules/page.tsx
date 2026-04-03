import { ModuleKey } from "@prisma/client";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleCompanyModuleFormAction } from "@/app/(protected)/super/company-modules/actions";
import { getAppContext } from "@/server/app-context";
import { db } from "@/server/db";

const MODULE_LABELS: Record<ModuleKey, string> = {
  MARKET_FLOW: "Market Flow",
};

export default async function SuperCompanyModulesPage() {
  const { company, session } = await getAppContext();

  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    include: {
      modules: true,
    },
  });

  return (
    <ProtectedPageShell
      companyName={company.name}
      title="Modulos por empresa"
      description="Activa o desactiva modulos contratados para cada tenant. Solo Super Admin global."
      moduleLabel="Global"
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Sesion: {session.user.email}. Esto afecta a todos los clientes; los usuarios del tenant solo ven Market Flow si
        esta habilitado aqui y ademas tienen accesos en su rol.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Slug</TableHead>
            {Object.values(ModuleKey).map((key) => (
              <TableHead key={key}>{MODULE_LABELS[key]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
              {Object.values(ModuleKey).map((moduleKey) => {
                const row = c.modules.find((m) => m.moduleKey === moduleKey);
                const isEnabled = row?.isEnabled ?? false;
                return (
                  <TableCell key={moduleKey}>
                    <form action={toggleCompanyModuleFormAction} className="inline">
                      <input type="hidden" name="companyId" value={c.id} />
                      <input type="hidden" name="moduleKey" value={moduleKey} />
                      <input type="hidden" name="nextEnabled" value={isEnabled ? "false" : "true"} />
                      <Button type="submit" variant={isEnabled ? "secondary" : "outline"} size="sm" className="rounded-xl">
                        {isEnabled ? "Activo" : "Inactivo"}
                      </Button>
                    </form>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ProtectedPageShell>
  );
}
