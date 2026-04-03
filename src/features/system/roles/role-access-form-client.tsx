"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateCompanyRoleAccessAction } from "@/features/system/roles/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ACCESS_CATALOG, type AccessKey } from "@/lib/access-catalog";
import { cn } from "@/lib/utils";

const GROUP_ORDER = ["General", "Market Flow", "Sistema de la empresa"];

export function RoleAccessFormClient({
  roleId,
  roleName,
  initialKeys,
}: {
  roleId: string;
  roleName: string;
  initialKeys: AccessKey[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(initialKeys));
  const [pending, startTransition] = React.useTransition();

  const grouped = React.useMemo(
    () =>
      GROUP_ORDER.map((g) => ({
        group: g,
        entries: ACCESS_CATALOG.filter((e) => e.group === g),
      })).filter((x) => x.entries.length > 0),
    [],
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateCompanyRoleAccessAction(roleId, [...selected]);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Accesos del rol actualizados.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Rol: <span className="font-medium text-foreground">{roleName}</span>. Marca las capacidades que tendran
        los usuarios con este rol (dentro de los modulos habilitados para la empresa).
      </p>
      {grouped.map(({ group, entries }) => (
        <div key={group} className="space-y-3 rounded-3xl border border-border/60 bg-card/60 p-5">
          <h2 className="text-sm font-semibold text-foreground">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {entries.map((entry) => {
              const on = selected.has(entry.key);
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => toggle(entry.key)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                    on
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/80 text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  <Label className="cursor-pointer font-medium text-foreground">{entry.label}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Button type="button" className="rounded-2xl" disabled={pending} onClick={handleSave}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Guardar accesos
      </Button>
    </div>
  );
}
