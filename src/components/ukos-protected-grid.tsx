"use client";

import { UkosSidebar } from "@/components/ukos-sidebar";

type Props = {
  companyName: string;
  userName: string;
  children: React.ReactNode;
};

export function UkosProtectedGrid({ companyName, userName, children }: Props) {
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="hidden lg:block">
        <UkosSidebar companyName={companyName} userName={userName} />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
