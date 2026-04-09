import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authOptions } from "@/server/auth-options";

/** Una sola lectura de sesión por petición RSC (layout + página suelen llamar ambos). */
export const getCurrentSession = cache(async () => getServerSession(authOptions));

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session;
}
