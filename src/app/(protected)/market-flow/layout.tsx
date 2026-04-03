import { requireAccess } from "@/server/tenant-authorization";

export default async function MarketFlowLayout({ children }: { children: React.ReactNode }) {
  await requireAccess("market_flow.section.view");
  return <>{children}</>;
}
