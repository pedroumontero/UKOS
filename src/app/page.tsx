import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth";
import { userHasAccess } from "@/server/tenant-authorization";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const uid = session.user.id;
  const cid = session.user.activeCompanyId;
  const role = session.user.role;

  if (await userHasAccess(uid, cid, role, "general.dashboard.view")) {
    redirect("/dashboard");
  }
  if (await userHasAccess(uid, cid, role, "market_flow.section.view")) {
    redirect("/market-flow/dashboard");
  }
  if (await userHasAccess(uid, cid, role, "tenant.system.nav.view")) {
    redirect("/system/users");
  }

  redirect("/sin-acceso");
}
