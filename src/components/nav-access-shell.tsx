"use client";

import * as React from "react";

import { UkosProtectedGrid } from "@/components/ukos-protected-grid";

type NavAccessValue = {
  grantedKeys: Set<string>;
  isSuperAdmin: boolean;
};

const NavAccessContext = React.createContext<NavAccessValue>({
  grantedKeys: new Set(),
  isSuperAdmin: false,
});

export function useNavAccess() {
  return React.useContext(NavAccessContext);
}

type Props = {
  grantedKeys: string[];
  isSuperAdmin: boolean;
  companyName: string;
  userName: string;
  children: React.ReactNode;
};

export function NavAccessShell({ grantedKeys, isSuperAdmin, companyName, userName, children }: Props) {
  // El servidor pasa un array nuevo en cada vuelo RSC; sin firma estable el Set y el context cambian siempre,
  // re-renderizando todo el arbol cliente y en algunos casos disparando peticiones RSC en bucle.
  const accessSnapshot = JSON.stringify([...grantedKeys].sort());
  const grantedSet = React.useMemo(() => new Set(grantedKeys), [accessSnapshot]);
  const value = React.useMemo(
    () => ({ grantedKeys: grantedSet, isSuperAdmin }),
    [grantedSet, isSuperAdmin],
  );

  return (
    <NavAccessContext.Provider value={value}>
      <UkosProtectedGrid companyName={companyName} userName={userName}>
        {children}
      </UkosProtectedGrid>
    </NavAccessContext.Provider>
  );
}
