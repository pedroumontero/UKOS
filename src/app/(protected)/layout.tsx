import { NavAccessShell } from "@/components/nav-access-shell";
import { UkosHeader } from "@/components/ukos-header";
import { getAppContext } from "@/server/app-context";
import { getEffectiveAccessSet } from "@/server/tenant-authorization";
import { UserRole } from "@prisma/client";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, company } = await getAppContext();
  const granted = await getEffectiveAccessSet(session.user.id, company.id, session.user.role);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.04),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(247,247,246,1)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_28%),linear-gradient(180deg,_rgba(12,12,13,1)_0%,_rgba(8,8,10,1)_100%)]">
      <NavAccessShell
        grantedKeys={[...granted]}
        isSuperAdmin={session.user.role === UserRole.SUPERADMIN}
        companyName={company.name}
        userName={session.user.name ?? session.user.email ?? "Usuario"}
      >
        {children}
      </NavAccessShell>
    </div>
  );
}

export function ProtectedPageShell({
  children,
  companyName,
  title,
  description,
  moduleLabel,
}: {
  children: React.ReactNode;
  companyName: string;
  title: string;
  description: string;
  moduleLabel?: string;
}) {
  return (
    <>
      <UkosHeader companyName={companyName} title={title} description={description} moduleLabel={moduleLabel} />
      <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </>
  );
}
