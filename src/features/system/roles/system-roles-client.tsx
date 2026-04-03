"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createCompanyRoleAction } from "@/features/system/roles/actions";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RoleRow = {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  permCount: number;
  userCount: number;
};

export function SystemRolesClient({
  roles,
  canCreate,
  canEdit,
}: {
  roles: RoleRow[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await createCompanyRoleAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Rol creado. Configura sus accesos en Editar.");
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button type="button" className="rounded-2xl" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Nuevo rol
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="rounded-3xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo rol</DialogTitle>
                <DialogDescription>
                  Crea un perfil para tu empresa. Luego asigna accesos en la pantalla de edicion.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cr-name">Nombre visible</Label>
                  <Input id="cr-name" name="name" required className="rounded-2xl" placeholder="Ej. Ventas" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="rounded-2xl" disabled={pending}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Crear rol
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
            <TableHead>Nombre</TableHead>
            <TableHead>Identificador</TableHead>
            <TableHead>Sistema</TableHead>
            <TableHead>Accesos</TableHead>
            <TableHead>Usuarios</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No hay roles configurados para esta empresa.
              </TableCell>
            </TableRow>
          ) : (
            roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.slug}</TableCell>
                <TableCell>{r.isSystem ? "Si" : "No"}</TableCell>
                <TableCell>{r.permCount}</TableCell>
                <TableCell>{r.userCount}</TableCell>
                <TableCell className="text-right">
                  {canEdit ? (
                    <Link
                      href={`/system/roles/${r.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-xl border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Editar accesos
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
