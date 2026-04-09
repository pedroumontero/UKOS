import { ProtectedPageShell } from "@/app/(protected)/layout";
import { InventoryPage } from "@/features/market-flow/inventory/inventory-page";
import { getAppContext } from "@/server/app-context";
import { getInventoryUnits } from "@/server/market-flow/inventory";
import { getEffectiveAccessSet, requireAccess } from "@/server/tenant-authorization";

type PageProps = {
  searchParams?: Promise<{ estado?: string }>;
};

export default async function MarketFlowInventoryPage({ searchParams }: PageProps) {
  await requireAccess("market_flow.inventory.view");
  const { company, session } = await getAppContext();
  const access = await getEffectiveAccessSet(session.user.id, company.id, session.user.role);
  const units = await getInventoryUnits(company.id);
  const resolvedSearch = searchParams ? await searchParams : {};
  const initialStatus = resolvedSearch.estado;

  return (
    <ProtectedPageShell
      companyName={company.name}
      moduleLabel="Market Flow"
      title="Inventario"
      description="Cada fila es una unidad fisica con fotos, costos, canales y seguimiento operativo."
    >
      <InventoryPage
        units={units}
        initialStatus={initialStatus}
        canCreate={access.has("market_flow.inventory.create")}
        canEdit={access.has("market_flow.inventory.edit")}
        canDelete={access.has("market_flow.inventory.delete")}
      />
    </ProtectedPageShell>
  );
}
