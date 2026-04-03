"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Button
      variant="ghost"
      title="Salir"
      className={cn(collapsed ? "size-9 justify-center p-0" : "justify-start")}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="size-4" />
      {collapsed ? <span className="sr-only">Salir</span> : "Salir"}
    </Button>
  );
}
