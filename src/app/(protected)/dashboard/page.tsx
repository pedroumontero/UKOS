import { Boxes, Building2, MessageSquareDot } from "lucide-react";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppContext } from "@/server/app-context";
import { getMarketFlowCounts } from "@/server/market-flow/inventory";
import { getEffectiveAccessSet, requireAccess } from "@/server/tenant-authorization";

/** Siempre datos frescos; evita reutilizar respuestas RSC cacheadas entre recargas en dev. */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAccess("general.dashboard.view");
  const { company, session } = await getAppContext();
  const access = await getEffectiveAccessSet(session.user.id, company.id, session.user.role);
  const counts = await getMarketFlowCounts(company.id);

  return (
    <ProtectedPageShell
      companyName={company.name}
      title="Dashboard General!"
      description="Tu empresa activa, inventario y leads en un solo vistazo para decidir con rapidez."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Empresa activa" value={company.name} helper="Contexto comercial de esta sesión" icon={Building2} />
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
            <CardTitle>Una cuenta, todo el contexto</CardTitle>
            <CardDescription>
              Inventario, canales y conversaciones viven bajo tu empresa activa, con permisos claros por rol.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Lo que cargas en Market Flow queda ordenado por empresa: sin mezclar datos ni perder el hilo
              comercial.
            </p>
            <p>
              Desde el menú lateral pasas de inventario a publicar, leads y configuraciones en segundos, sin saltar
              entre herramientas sueltas.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Tres palancas para vender mejor</CardTitle>
            <CardDescription>Flujo pensado para equipos que cierran operaciones, no solo para registrarlas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Inventario: deja cada unidad con fotos y precio; ahí nace tu vitrina comercial.</p>
            <p>2. Publicar: lleva el stock al canal adecuado cuando esté listo para la venta.</p>
            <p>3. Leads: convierte conversaciones en seguimiento sin depender de bandejas sueltas.</p>
          </CardContent>
        </Card>
      </div>
    </ProtectedPageShell>
  );
}
