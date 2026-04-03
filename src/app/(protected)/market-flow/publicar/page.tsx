import { Suspense } from "react";

import { ProtectedPageShell } from "@/app/(protected)/layout";
import { PublishPage } from "@/features/market-flow/publish/publish-page";
import { getAppContext } from "@/server/app-context";
import { getPublishQueue } from "@/server/market-flow/publish";
import { requireAccess } from "@/server/tenant-authorization";

type PageProps = {
  searchParams?: Promise<{ canal?: string }>;
};

export default async function MarketFlowPublishPage({ searchParams }: PageProps) {
  await requireAccess("market_flow.publish.view");
  const { company } = await getAppContext();
  const entries = await getPublishQueue(company.id);
  const resolved = searchParams ? await searchParams : {};
  const initialChannelId = resolved.canal ?? null;

  return (
    <ProtectedPageShell
      companyName={company.name}
      moduleLabel="Market Flow"
      title="Publicar"
      description="Cola real por canal: edita copy, precios y marca cuando ya salio al marketplace."
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
