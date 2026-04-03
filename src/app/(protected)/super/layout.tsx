import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireSession } from "@/server/auth";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.user.role !== UserRole.SUPERADMIN) {
    redirect("/dashboard");
  }
  return <div className="min-w-0">{children}</div>;
}
