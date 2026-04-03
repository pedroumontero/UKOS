import { ProtectedPageShell } from "@/app/(protected)/layout";
import { MarketFlowSettingsPageClient } from "@/features/market-flow/settings/settings-page";
import { getAppContext } from "@/server/app-context";
import { db } from "@/server/db";
import { requireAccess } from "@/server/tenant-authorization";

export default async function MarketFlowSettingsPage() {
  await requireAccess("market_flow.settings.view");
  const { company, marketFlowSettings } = await getAppContext();

  const channels = await db.channel.findMany({
    where: { companyId: company.id },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <ProtectedPageShell
      companyName={company.name}
      moduleLabel="Market Flow"
      title="Configuraciones"
      description="Parametros reales por empresa: nombre, rubro, canales, tono de IA y credenciales guardadas."
    >
      <MarketFlowSettingsPageClient
        company={{ id: company.id, name: company.name }}
        marketFlowSettings={
          marketFlowSettings
            ? {
                industryType: marketFlowSettings.industryType,
                aiToneProfile: marketFlowSettings.aiToneProfile,
                defaultPriceStrategy: marketFlowSettings.defaultPriceStrategy,
                settingsJson: marketFlowSettings.settingsJson,
              }
            : null
        }
        channels={channels.map((channel) => ({
          id: channel.id,
          displayName: channel.displayName,
          code: channel.code,
          isEnabled: channel.isEnabled,
          sortOrder: channel.sortOrder,
        }))}
      />
    </ProtectedPageShell>
  );
}
