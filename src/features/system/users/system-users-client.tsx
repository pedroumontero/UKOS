"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  createCompanyUserAction,
  removeUserAccessOverrideAction,
  updateUserCompanyRoleAction,
  upsertUserAccessOverrideAction,
} from "@/features/system/users/actions";
import { getAccessEntry } from "@/lib/access-catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MembershipRow = {
  id: string;
  userId: string;
  user: { email: string; name: string; role: string };
  companyRole: { id: string; name: string };
};

type RoleOption = { id: string; name: string };

type OverrideRow = { id: string; accessKey: string; effect: "ALLOW" | "DENY" };

type AccessOption = { key: string; label: string };

export function SystemUsersClient({
  memberships,
  tenantRoles,
  canCreate,
  canEdit,
  overridesByUserId,
  accessOptions,
}: {
  memberships: MembershipRow[];
  tenantRoles: RoleOption[];
  canCreate: boolean;
  canEdit: boolean;
  overridesByUserId: Record<string, OverrideRow[]>;
  accessOptions: AccessOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [companyRoleId, setCompanyRoleId] = React.useState("");

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [active, setActive] = React.useState<MembershipRow | null>(null);
  const [editRoleId, setEditRoleId] = React.useState("");
  const [addAccessKey, setAddAccessKey] = React.useState("");
  const [addEffect, setAddEffect] = React.useState<"ALLOW" | "DENY">("ALLOW");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyRoleId.trim()) {
      toast.error("Selecciona un rol en la empresa.");
      return;
    }
    const form = event.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      const result = await createCompanyUserAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Usuario creado. Ya puede iniciar sesion.");
      setOpen(false);
      setCompanyRoleId("");
      form.reset();
      router.refresh();
    });
  }

  function openSheet(row: MembershipRow) {
    setActive(row);
    setEditRoleId(row.companyRole.id);
    setAddAccessKey("");
    setAddEffect("ALLOW");
    setSheetOpen(true);
  }

  function saveRole() {
    if (!active) return;
    startTransition(async () => {
      const result = await updateUserCompanyRoleAction(active.id, editRoleId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Rol actualizado.");
      setSheetOpen(false);
      router.refresh();
    });
  }

  function addOverride() {
    if (!active || !addAccessKey) {
      toast.error("Selecciona un acceso.");
      return;
    }
    startTransition(async () => {
      const result = await upsertUserAccessOverrideAction(active.userId, addAccessKey, addEffect);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Excepcion guardada.");
      setAddAccessKey("");
      router.refresh();
    });
  }

  function removeOverride(id: string) {
    startTransition(async () => {
      const result = await removeUserAccessOverrideAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Excepcion eliminada.");
      router.refresh();
    });
  }

  const platformLabel = (role: string) => {
    if (role === "OPERATOR") return "Operador";
    if (role === "ADMIN") return "Administrador";
    if (role === "SUPERADMIN") return "Superadministrador";
    return role;
  };

  return (
    <div className="space-y-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button type="button" className="rounded-2xl" onClick={() => setOpen(true)}>
            Nuevo usuario
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="rounded-3xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo usuario</DialogTitle>
                <DialogDescription>
                  Se crea en esta empresa con el rol que elijas. El correo debe ser unico en todo UKOS.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nombre</Label>
                  <Input id="su-name" name="name" required className="rounded-2xl" autoComplete="name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Correo</Label>
                  <Input
                    id="su-email"
                    name="email"
                    type="email"
                    required
                    className="rounded-2xl"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Contrasena temporal</Label>
                  <Input
                    id="su-password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    className="rounded-2xl"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">Minimo 8 caracteres.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-role">Rol en la empresa</Label>
                  <input type="hidden" name="companyRoleId" value={companyRoleId} required={false} />
                  <Select
                    value={companyRoleId === "" ? undefined : companyRoleId}
                    onValueChange={(v) => setCompanyRoleId(v ?? "")}
                  >
                    <SelectTrigger id="su-role" className="w-full rounded-2xl">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {tenantRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" className="rounded-2xl" disabled={pending}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    Crear usuario
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Correo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Acceso en plataforma</TableHead>
            <TableHead>Rol en la empresa</TableHead>
            <TableHead>Excepciones</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberships.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="text-muted-foreground">
                No hay usuarios asignados a esta empresa todavia.
              </TableCell>
            </TableRow>
          ) : (
            memberships.map((m) => {
              const ov = overridesByUserId[m.userId] ?? [];
              return (
                <TableRow key={m.id}>
                  <TableCell>{m.user.email}</TableCell>
                  <TableCell>{m.user.name}</TableCell>
                  <TableCell>{platformLabel(m.user.role)}</TableCell>
                  <TableCell>{m.companyRole.name}</TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {ov.length === 0
                      ? "—"
                      : ov
                          .map((o) => {
                            const label = getAccessEntry(o.accessKey)?.label ?? o.accessKey;
                            return `${o.effect === "ALLOW" ? "+" : "−"} ${label}`;
                          })
                          .join(" · ")}
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={m.user.role === "SUPERADMIN"}
                        onClick={() => openSheet(m)}
                      >
                        Gestionar
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full max-w-md rounded-l-3xl sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Usuario y excepciones</SheetTitle>
            <SheetDescription>
              Cambia el rol en la empresa o agrega permitir / bloquear sobre accesos concretos (encima del rol).
            </SheetDescription>
          </SheetHeader>
          {active ? (
            <div className="mt-6 space-y-6">
              <div className="text-sm">
                <p className="font-medium text-foreground">{active.user.name}</p>
                <p className="text-muted-foreground">{active.user.email}</p>
              </div>
              <div className="space-y-2">
                <Label>Rol en la empresa</Label>
                <Select value={editRoleId} onValueChange={(v) => setEditRoleId(v ?? "")}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {tenantRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" className="rounded-2xl" disabled={pending} onClick={saveRole}>
                  Guardar rol
                </Button>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-sm font-semibold text-foreground">Excepciones por acceso</p>
                <ul className="space-y-2 text-sm">
                  {(overridesByUserId[active.userId] ?? []).map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground">
                        {getAccessEntry(o.accessKey)?.label ?? o.accessKey}
                      </span>
                      <span className="text-xs font-medium">{o.effect}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 rounded-lg"
                        disabled={pending}
                        onClick={() => removeOverride(o.id)}
                      >
                        Quitar
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Label>Agregar excepcion</Label>
                  <Select value={addAccessKey || undefined} onValueChange={(v) => setAddAccessKey(v ?? "")}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="Elige acceso" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 rounded-2xl">
                      {accessOptions.map((a) => (
                        <SelectItem key={a.key} value={a.key}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={addEffect} onValueChange={(v) => setAddEffect(v as "ALLOW" | "DENY")}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="ALLOW">Permitir (Allow)</SelectItem>
                      <SelectItem value="DENY">Bloquear (Deny)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="secondary" className="rounded-2xl" disabled={pending} onClick={addOverride}>
                    Aplicar excepcion
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
