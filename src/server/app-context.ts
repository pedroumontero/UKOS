import { ModuleKey } from "@prisma/client";
import { requireSession } from "@/server/auth";
import { db } from "@/server/db";

export async function getAppContext() {
  const session = await requireSession();
  const companyId = session.user.activeCompanyId;

  const [company, modules, marketFlowSettings, channels] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: companyId },
    }),
    db.companyModule.findMany({
      where: {
        companyId,
        isEnabled: true,
      },
      orderBy: { enabledAt: "asc" },
    }),
    db.companyModuleSettings.findUnique({
      where: {
        companyId_moduleKey: {
          companyId,
          moduleKey: ModuleKey.MARKET_FLOW,
        },
      },
    }),
    db.channel.findMany({
      where: {
        companyId,
        isEnabled: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return {
    session,
    company,
    modules,
    channels,
    marketFlowSettings,
  };
}
