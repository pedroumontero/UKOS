import { ProtectedPageShell } from "@/app/(protected)/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCESS_CATALOG } from "@/lib/access-catalog";
import { getAppContext } from "@/server/app-context";
import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";

export default async function SystemAccessPage() {
  await requireAccess("tenant.access.catalog_view");
  const { company } = await getAppContext();

  const roles = await db.companyRole.findMany({
    where: { companyId: company.id },
    include: { permissions: true },
    orderBy: { name: "asc" },
  });

  return (
    <ProtectedPageShell
      companyName={company.name}
      title="Accesos"
      description="Capacidades funcionales de la aplicacion. Se asignan a cada rol; puedes afinar por usuario con excepciones."
      moduleLabel="Sistema"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Acceso</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead>Roles que lo incluyen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ACCESS_CATALOG.map((entry) => {
            const roleNames = roles
              .filter((r) => r.permissions.some((p) => p.permissionKey === entry.key))
              .map((r) => r.name)
              .join(", ");
            return (
              <TableRow key={entry.key}>
                <TableCell className="max-w-[14rem] text-sm font-medium">{entry.label}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{entry.description}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{roleNames || "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ProtectedPageShell>
  );
}
