import { Boxes, Building2, MessageSquareDot } from "lucide-react";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppContext } from "@/server/app-context";
import { getMarketFlowCounts } from "@/server/market-flow/inventory";
import { getEffectiveAccessSet, requireAccess } from "@/server/tenant-authorization";

export default async function DashboardPage() {
  await requireAccess("general.dashboard.view");
  const { company, session } = await getAppContext();
  const access = await getEffectiveAccessSet(session.user.id, company.id, session.user.role);
  const counts = await getMarketFlowCounts(company.id);

  return (
    <ProtectedPageShell
      companyName={company.name}
      title="Dashboard General"
      description="Entrada limpia al sistema madre con visibilidad inicial del modulo activo."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Empresa activa" value={company.name} helper="Nombre de la empresa en sesion" icon={Building2} />
        <MetricCard
          label="Unidades en Market Flow"
          value={counts.totalUnits}
          helper="Ir al inventario"
          icon={Boxes}
          href={access.has("market_flow.inventory.view") ? "/market-flow/inventario" : undefined}
        />
        <MetricCard
          label="Leads"
          value={counts.leadCount}
          helper="Abrir leads"
          icon={MessageSquareDot}
          href={access.has("market_flow.leads.view") ? "/market-flow/leads" : undefined}
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Estado del sistema</CardTitle>
            <CardDescription>UKOS opera con empresa activa, autenticacion y modulos por tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Cada registro de Market Flow queda ligado a la empresa activa.</p>
            <p>Usa el menu lateral para moverte entre inventario, publicar, leads y configuraciones.</p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Siguientes pasos sugeridos</CardTitle>
            <CardDescription>Operacion diaria tipica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Captura unidades con fotos y precios en Inventario.</p>
            <p>2. Publica canal por canal cuando esten listas.</p>
            <p>3. Registra conversaciones en Leads.</p>
          </CardContent>
        </Card>
      </div>
    </ProtectedPageShell>
  );
}
