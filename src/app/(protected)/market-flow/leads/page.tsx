import { ProtectedPageShell } from "@/app/(protected)/layout";
import { LeadsPage } from "@/features/market-flow/leads/leads-page";
import { getAppContext } from "@/server/app-context";
import { getLeadFormContext, getLeads } from "@/server/market-flow/leads";
import { requireAccess } from "@/server/tenant-authorization";

export default async function MarketFlowLeadsPage() {
  await requireAccess("market_flow.leads.view");
  const { company } = await getAppContext();
  const [leads, formContext] = await Promise.all([
    getLeads(company.id),
    getLeadFormContext(company.id),
  ]);

  return (
    <ProtectedPageShell
      companyName={company.name}
      moduleLabel="Market Flow"
      title="Leads"
      description="Tabla funcional de personas, con conversacion simple y contexto del producto."
    >
      <LeadsPage leads={leads} formContext={formContext} />
    </ProtectedPageShell>
  );
}
