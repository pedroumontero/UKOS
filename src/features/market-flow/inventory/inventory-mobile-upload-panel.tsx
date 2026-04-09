"use client";

import * as React from "react";
import { Check, Copy, Loader2, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";

import { InventoryQrCode } from "@/components/inventory-qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InventoryUnit } from "@/features/market-flow/inventory/types";
import {
  getInventoryUnitMediaSnapshotAction,
  type MobileUploadSessionPayload,
} from "@/features/market-flow/inventory/mobile-upload-actions";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onDismiss: () => void | Promise<void>;
  session: MobileUploadSessionPayload | null;
  unitId: string;
  onMediaSynced: (media: InventoryUnit["media"]) => void;
};

export function InventoryMobileUploadPanel({ open, onDismiss, session, unitId, onMediaSynced }: Props) {
  const [copied, setCopied] = React.useState(false);
  const [pollError, setPollError] = React.useState<string | null>(null);

  const fullUrl =
    typeof window !== "undefined" && session ? `${window.location.origin}${session.path}` : session?.path ?? "";

  const onMediaSyncedRef = React.useRef(onMediaSynced);
  React.useEffect(() => {
    onMediaSyncedRef.current = onMediaSynced;
  }, [onMediaSynced]);

  React.useEffect(() => {
    if (!open || !session) return;

    let cancelled = false;
    const tick = async () => {
      const snap = await getInventoryUnitMediaSnapshotAction(unitId);
      if (cancelled) return;
      if (!snap.ok) {
        setPollError(snap.error);
        return;
      }
      setPollError(null);
      onMediaSyncedRef.current(snap.media);
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, session, unitId]);

  const handleCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Enlace copiado");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Copia el enlace manualmente.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          void onDismiss();
        }
      }}
    >
      <DialogContent
        overlayClassName="z-[200] bg-black/45 supports-backdrop-filter:backdrop-blur-[2px]"
        className={cn(
          // Centrado seguro en móvil: evita recortes con translate-y-50% cuando el teclado o el viewport cambian.
          "z-[210] !top-4 !translate-y-0 sm:!top-1/2 sm:!-translate-y-1/2",
          "flex max-h-[min(90dvh,42rem)] w-[min(100vw-1.5rem,26rem)] max-w-none flex-col gap-0 overflow-hidden rounded-[1.75rem] border-border/60 p-0 shadow-lg sm:w-[26rem]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-5 pb-4 pt-6 text-left sm:px-6 sm:pt-7">
          <DialogTitle className="flex items-center gap-2 pr-8 text-xl font-semibold tracking-tight">
            <Smartphone className="size-5 shrink-0 text-primary" aria-hidden />
            Subir desde mi teléfono
          </DialogTitle>
          <DialogDescription className="text-pretty text-sm leading-relaxed">
            Escanea el código o abre el enlace en tu móvil. Las fotos se guardan en esta unidad al instante.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {!session ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary/80" aria-hidden />
              <p>Preparando enlace seguro…</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/40 px-4 py-5">
                <div className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border/30 dark:bg-background">
                  {fullUrl ? (
                    <InventoryQrCode
                      value={fullUrl}
                      size={176}
                      level="M"
                      marginSize={1}
                      className="h-auto w-[176px] max-w-full"
                    />
                  ) : null}
                </div>
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  Vence:{" "}
                  {new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(session.expiresAt))}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enlace</p>
                <div className="flex gap-2">
                  <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-xl border border-border/60 bg-background px-3 py-2">
                    <p className="w-full break-all text-left font-mono text-[11px] leading-snug text-foreground sm:text-xs">
                      {fullUrl || session.path}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-11 shrink-0 rounded-xl"
                    onClick={() => void handleCopy()}
                    disabled={!fullUrl}
                  >
                    {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  </Button>
                </div>
              </div>

              {pollError ? (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {pollError}
                </div>
              ) : (
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  La galería del inventario se actualiza cada pocos segundos con este panel abierto.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 bg-muted/20 px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" className="h-11 w-full rounded-2xl" onClick={() => void onDismiss()}>
            Cerrar y anular enlace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
