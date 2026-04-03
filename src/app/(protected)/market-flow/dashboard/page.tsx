import Link from "next/link";
import { Boxes, CircleDashed, MessageCircleMore, RadioTower, SendToBack } from "lucide-react";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppContext } from "@/server/app-context";
import { getMarketFlowCounts } from "@/server/market-flow/inventory";
import { requireAccess } from "@/server/tenant-authorization";

export default async function MarketFlowDashboardPage() {
  await requireAccess("market_flow.dashboard.view");
  const { company, channels } = await getAppContext();
  const counts = await getMarketFlowCounts(company.id);

  const channelCounts = channels.map((channel) => {
    const published = counts.publications.find(
      (item) => item.channelId === channel.id && item.status === "PUBLISHED",
    );
    return {
      name: channel.displayName,
      value: published?._count.status ?? 0,
    };
  });

  return (
    <ProtectedPageShell
      companyName={company.name}
      moduleLabel="Market Flow"
      title="Dashboard"
      description="Conteos utiles y visibilidad operativa del modulo desde el primer bloque real."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Unidades"
          value={counts.totalUnits}
          helper="Ver inventario completo"
          icon={Boxes}
          href="/market-flow/inventario"
        />
        <MetricCard
          label="Borrador"
          value={counts.draft}
          helper="Filtrar borradores"
          icon={CircleDashed}
          href="/market-flow/inventario?estado=DRAFT"
        />
        <MetricCard
          label="Listo para publicar"
          value={counts.readyToPublish}
          helper="Filtrar listos"
          icon={SendToBack}
          href="/market-flow/inventario?estado=READY_TO_PUBLISH"
        />
        <MetricCard label="Leads" value={counts.leadCount} helper="Abrir bandeja de leads" icon={RadioTower} href="/market-flow/leads" />
        <MetricCard
          label="Conversaciones activas"
          value={counts.activeConversationCount}
          helper="Ir a leads"
          icon={MessageCircleMore}
          href="/market-flow/leads"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Conteo por estado operativo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(
              [
                ["Borrador", counts.draft, "DRAFT"],
                ["Recibido", counts.received, "RECEIVED"],
                ["Listo para publicar", counts.readyToPublish, "READY_TO_PUBLISH"],
                ["Publicado", counts.published, "PUBLISHED"],
                ["Vendido", counts.sold, "SOLD"],
              ] as const
            ).map(([label, value, estado]) => (
              <Link
                key={estado}
                href={`/market-flow/inventario?estado=${estado}`}
                className="rounded-[1.5rem] border border-border/60 bg-background/90 p-4 transition hover:border-primary/50 hover:bg-accent/20"
              >
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{String(value)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Publicaciones por canal</CardTitle>
            <CardDescription>Unidades marcadas como publicadas en cada canal habilitado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channelCounts.map((channel) => (
              <div key={channel.name} className="flex items-center justify-between rounded-[1.25rem] border border-border/60 bg-background/90 p-4">
                <p className="font-medium text-foreground">{channel.name}</p>
                <p className="text-lg font-semibold text-foreground">{channel.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ProtectedPageShell>
  );
}
