import { Suspense } from "react";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { PublishPage } from "@/features/market-flow/publish/publish-page";
import { getAppContext } from "@/server/app-context";
import { getPublicationEntryById, getPublishQueue } from "@/server/market-flow/publish";
import { requireAccess } from "@/server/tenant-authorization";

type PageProps = {
  searchParams?: Promise<{ canal?: string; publicacion?: string }>;
};

export default async function MarketFlowPublishPage({ searchParams }: PageProps) {
  await requireAccess("market_flow.publish.view");
  const { company } = await getAppContext();
  const resolved = searchParams ? await searchParams : {};
  const publicationFocusId = typeof resolved.publicacion === "string" ? resolved.publicacion.trim() : "";

  const queue = await getPublishQueue(company.id);
  const focused =
    publicationFocusId.length > 0 ? await getPublicationEntryById(company.id, publicationFocusId) : null;

  const entries =
    focused && !queue.some((e) => e.id === focused.id) ? [focused, ...queue] : queue;

  const initialChannelId = focused?.channel.id ?? resolved.canal ?? null;

  return (
    <ProtectedPageShell
      companyName={company.name}
      moduleLabel="Market Flow"
      title="Publicar"
      description="Cola por canal: lo pendiente aparece aquí; lo ya publicado sigue en Inventario y puedes reabrirlo con Gestionar publicación."
    >
      <Suspense
        fallback={
          <div className="rounded-[2rem] border border-border/60 bg-card/80 p-8 text-sm text-muted-foreground">
            Cargando cola de publicacion...
          </div>
        }
      >
        <PublishPage entries={entries} initialChannelId={initialChannelId} />
      </Suspense>
    </ProtectedPageShell>
  );
}
