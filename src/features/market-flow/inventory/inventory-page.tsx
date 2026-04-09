"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  PackagePlus,
  Search,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ChannelIndicators } from "@/components/channel-indicators";
import { getProductUnitStatusLabel, StatusBadge, productStatusOptions } from "@/components/status-badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { analyzeInventoryProductPhotosAction } from "@/features/market-flow/inventory/ai-actions";
import {
  createProductUnitAction,
  deleteProductUnitAction,
  updateProductUnitAction,
} from "@/features/market-flow/inventory/actions";
import { InventoryMediaThumbnail } from "@/features/market-flow/inventory/inventory-media-thumbnail";
import { InventoryMobileUploadPanel } from "@/features/market-flow/inventory/inventory-mobile-upload-panel";
import {
  createInventoryMobileUploadSessionAction,
  ensureDraftProductUnitForMobileUploadAction,
  getInventoryUnitMediaSnapshotAction,
  revokeInventoryMobileUploadSessionAction,
  type MobileUploadSessionPayload,
} from "@/features/market-flow/inventory/mobile-upload-actions";
import { validateInventoryPhotoPayload } from "@/features/market-flow/inventory/upload-limits";
import { titleForInventoryFormField } from "@/lib/inventory-product-constants";
import {
  deleteProductMediaAction,
  reorderProductMediaAction,
  setPrimaryProductMediaAction,
} from "@/features/market-flow/inventory/media-actions";
import type { InventoryUnit } from "@/features/market-flow/inventory/types";
import type { InventoryVisionResult } from "@/server/market-flow/inventory-ai-schema";
import { cn } from "@/lib/utils";

const statusTabs = [
  { label: "Todos", value: "all" },
  { label: "Borrador", value: "DRAFT" },
  { label: "Recibido", value: "RECEIVED" },
  { label: "Por publicar", value: "READY_TO_PUBLISH" },
  { label: "Publicado", value: "PUBLISHED" },
  { label: "Vendido", value: "SOLD" },
] as const;

type InventoryPageProps = {
  units: InventoryUnit[];
  initialStatus?: string;
  /** Si el usuario no puede crear, se oculta el alta de unidades (el servidor igual valida). */
  canCreate?: boolean;
  /** Si no puede editar, las filas son solo lectura. */
  canEdit?: boolean;
  /** Eliminar unidades (permiso `market_flow.inventory.delete`). */
  canDelete?: boolean;
};

type ProductOverlayProps = {
  mode: "create" | "edit";
  unit?: InventoryUnit;
  trigger?: React.ReactNode;
  /** Permite generar enlace móvil (crear borrador + subir fotos). */
  allowMobileUpload?: boolean;
};

function formatUtcDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatUtcDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

const VALID_STATUS = new Set<string>(statusTabs.map((tab) => tab.value));

export function InventoryPage({
  units,
  initialStatus,
  canCreate = true,
  canEdit = true,
  canDelete = false,
}: InventoryPageProps) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<(typeof statusTabs)[number]["value"]>(() => {
    if (initialStatus && initialStatus !== "all" && VALID_STATUS.has(initialStatus)) {
      return initialStatus as (typeof statusTabs)[number]["value"];
    }
    return "all";
  });

  const filteredUnits = React.useMemo(() => {
    return units.filter((unit) => {
      const matchesStatus = status === "all" ? true : unit.status === status;
      const haystack = `${unit.number} ${unit.title} ${unit.brand ?? ""} ${unit.model ?? ""}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }, [query, status, units]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-xl">Inventario por unidad</CardTitle>
            <CardDescription>
              Unidades reales con costo, precio y estado por canal.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="relative flex-1 sm:min-w-72 lg:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por numero, producto o marca"
                className="h-11 rounded-2xl pl-9"
              />
            </div>
            {canCreate ? (
              <ProductOverlay
                mode="create"
                allowMobileUpload={canCreate}
                trigger={
                  <Button className="h-11 rounded-2xl px-5">
                    <PackagePlus className="size-4" />
                    Nuevo Producto
                  </Button>
                }
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusTabs.map((item) => (
              <Button
                key={item.value}
                variant={status === item.value ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setStatus(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <ResponsiveInventory units={filteredUnits} canEdit={canEdit} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteUnitButton({
  unit,
  layout = "icon",
}: {
  unit: Pick<InventoryUnit, "id" | "number" | "title">;
  layout?: "icon" | "bar";
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProductUnitAction(unit.id);
      if (result.ok) {
        toast.success("Producto eliminado");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      {layout === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setOpen(true)}
          aria-label={`Eliminar ${unit.number}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="mr-2 size-4 shrink-0" />
          Eliminar producto
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && pending) return;
          setOpen(next);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar producto</DialogTitle>
            <DialogDescription>
              Vas a eliminar {unit.number} — {titleForInventoryFormField(unit.title) || "sin título"}. Se quitan las
              fotos del servidor, publicaciones y datos
              de la unidad. Los leads vinculados quedan sin unidad. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResponsiveInventory({
  units,
  canEdit,
  canDelete,
}: {
  units: InventoryUnit[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(media.matches);

    onChange();
    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  if (isMobile) {
    return (
      <div className="space-y-3">
        {units.map((unit) => (
          <div key={unit.id} className="space-y-2">
            {canEdit ? (
              <ProductOverlay
                mode="edit"
                unit={unit}
                allowMobileUpload={canEdit}
                trigger={
                  <button
                    type="button"
                    className="w-full rounded-[1.75rem] border border-border/60 bg-background/90 p-4 text-left shadow-sm transition hover:border-border hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{unit.number}</p>
                        <h3 className="mt-1 line-clamp-2 text-base font-semibold text-foreground">
                          {titleForInventoryFormField(unit.title) || unit.number}
                        </h3>
                      </div>
                      <StatusBadge status={unit.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <Meta label="Costo" value={unit.costAmount ? `$${unit.costAmount}` : "Pendiente"} />
                      <Meta label="Precio" value={unit.salePrice ? `$${unit.salePrice}` : "Pendiente"} />
                      <Meta label="Fecha" value={formatUtcDate(unit.registeredAt)} />
                      <Meta
                        label="Canales"
                        value={`${unit.publications.filter((item) => item.status === "PUBLISHED").length}/${unit.publications.length}`}
                      />
                    </div>
                    <div className="mt-4">
                      <ChannelIndicators
                        channels={unit.publications.map((publication) => ({
                          name: publication.channel.displayName,
                          code: publication.channel.code,
                          status: publication.status,
                        }))}
                      />
                    </div>
                  </button>
                }
              />
            ) : (
              <div className="w-full rounded-[1.75rem] border border-border/60 bg-background/90 p-4 text-left shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{unit.number}</p>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold text-foreground">
                      {titleForInventoryFormField(unit.title) || unit.number}
                    </h3>
                  </div>
                  <StatusBadge status={unit.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Meta label="Costo" value={unit.costAmount ? `$${unit.costAmount}` : "Pendiente"} />
                  <Meta label="Precio" value={unit.salePrice ? `$${unit.salePrice}` : "Pendiente"} />
                  <Meta label="Fecha" value={formatUtcDate(unit.registeredAt)} />
                  <Meta
                    label="Canales"
                    value={`${unit.publications.filter((item) => item.status === "PUBLISHED").length}/${unit.publications.length}`}
                  />
                </div>
                <div className="mt-4">
                  <ChannelIndicators
                    channels={unit.publications.map((publication) => ({
                      name: publication.channel.displayName,
                      code: publication.channel.code,
                      status: publication.status,
                    }))}
                  />
                </div>
              </div>
            )}
            {canDelete ? <DeleteUnitButton unit={unit} layout="bar" /> : null}
          </div>
        ))}
        {!units.length ? <EmptyInventory /> : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/90">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[7.5rem]" />
          <col className="w-[min(32rem,42vw)]" />
          <col className="w-[9rem]" />
          <col className="w-[7.5rem]" />
          <col className="w-[9rem]" />
          <col className="w-[9.5rem]" />
          <col className="w-[8rem]" />
          {canDelete ? <col className="w-[4.5rem]" /> : null}
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Numero</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead>Precio De Venta</TableHead>
            <TableHead>Fecha De Registro</TableHead>
            <TableHead>Canales</TableHead>
            {canDelete ? <TableHead className="w-[4.5rem] text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((unit) => (
            <TableRow key={unit.id}>
              <TableCell className="font-medium text-foreground">{unit.number}</TableCell>
              <TableCell className="min-w-0 pr-3">
                {canEdit ? (
                  <ProductOverlay
                    mode="edit"
                    unit={unit}
                    allowMobileUpload={canEdit}
                    trigger={
                      <button type="button" className="w-full min-w-0 text-left transition hover:text-primary">
                        <TruncatedTextWithTooltip
                          text={titleForInventoryFormField(unit.title) || unit.number}
                          className="font-semibold text-foreground"
                        />
                        <p className="truncate text-sm text-muted-foreground">
                          {[unit.brand, unit.model].filter(Boolean).join(" / ") || "—"}
                        </p>
                      </button>
                    }
                  />
                ) : (
                  <div className="min-w-0 text-left">
                    <TruncatedTextWithTooltip
                      text={titleForInventoryFormField(unit.title) || unit.number}
                      className="font-semibold text-foreground"
                    />
                    <p className="truncate text-sm text-muted-foreground">
                      {[unit.brand, unit.model].filter(Boolean).join(" / ") || "—"}
                    </p>
                  </div>
                )}
              </TableCell>
              <TableCell><StatusBadge status={unit.status} /></TableCell>
              <TableCell>{unit.costAmount ? `$${unit.costAmount}` : "Pendiente"}</TableCell>
              <TableCell>{unit.salePrice ? `$${unit.salePrice}` : "Pendiente"}</TableCell>
              <TableCell>{formatUtcDate(unit.registeredAt)}</TableCell>
              <TableCell>
                <ChannelIndicators
                  channels={unit.publications.map((publication) => ({
                    name: publication.channel.displayName,
                    code: publication.channel.code,
                    status: publication.status,
                  }))}
                />
              </TableCell>
              {canDelete ? (
                <TableCell className="text-right">
                  <DeleteUnitButton unit={unit} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {!units.length ? (
            <TableRow>
              <TableCell colSpan={canDelete ? 8 : 7}>
                <EmptyInventory />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function ProductOverlay({ mode, unit, trigger, allowMobileUpload = true }: ProductOverlayProps) {
  const [open, setOpen] = React.useState(false);
  const [sessionKey, setSessionKey] = React.useState(0);

  const handleOpenChange = React.useCallback((next: boolean) => {
    if (next) {
      setSessionKey((k) => k + 1);
    }
    setOpen(next);
  }, []);

  return (
    <>
      <span className="inline-flex" onClick={() => handleOpenChange(true)}>
        {trigger ?? <Button>Nuevo Producto</Button>}
      </span>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[94vh] w-[min(1120px,calc(100vw-1rem))] max-w-none flex-col rounded-[1.75rem] border-border/60 bg-background p-0 sm:h-[92vh] sm:w-[min(1100px,calc(100vw-2rem))] sm:rounded-[2rem]">
        <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-8 sm:py-6">
          <DialogTitle className="text-2xl">
            {mode === "create"
              ? "Nuevo producto"
              : titleForInventoryFormField(unit?.title) || unit?.number || "Unidad"}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span>
              Fotos, ficha técnica, costos y estado por canal. Los cambios se guardan al confirmar.
            </span>
            <span className="block text-xs text-muted-foreground">
              Con «Guardar cambios» o «Guardar producto», el estado se ajusta solo según los datos: borrador sin
              título, recibido con título incompleto, por publicar cuando están llenos los campos clave.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">
          <ProductOverlayContent
            key={sessionKey}
            mode={mode}
            unit={unit}
            allowMobileUpload={allowMobileUpload}
            dialogOpen={open}
            onDone={() => {
              setOpen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ProductOverlayContent({
  mode,
  unit,
  allowMobileUpload,
  dialogOpen,
  onDone,
}: {
  mode: "create" | "edit";
  unit?: InventoryUnit;
  allowMobileUpload: boolean;
  dialogOpen: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [aiPending, startAiTransition] = React.useTransition();
  const [files, setFiles] = React.useState<File[]>([]);
  const [provisionalUnit, setProvisionalUnit] = React.useState<InventoryUnit | null>(null);
  const [mobileUploadOpen, setMobileUploadOpen] = React.useState(false);
  const [mobileSession, setMobileSession] = React.useState<MobileUploadSessionPayload | null>(null);
  const [liveServerMedia, setLiveServerMedia] = React.useState<InventoryUnit["media"] | null>(null);
  const [mobileBusy, setMobileBusy] = React.useState(false);

  const effectiveUnit = unit ?? provisionalUnit;

  const [status, setStatus] = React.useState(unit?.status ?? "DRAFT");
  const [aiContext, setAiContext] = React.useState(unit?.aiContext ?? "");
  const [accordionOpen, setAccordionOpen] = React.useState<string[]>([]);
  const formRef = React.useRef<HTMLFormElement>(null);
  const storageKey = React.useMemo(
    () =>
      `market-flow-product-draft:${effectiveUnit?.id ? "edit" : mode}:${effectiveUnit?.id ?? "new"}`,
    [mode, effectiveUnit?.id],
  );

  React.useEffect(() => {
    if (!provisionalUnit?.id) return;
    setStatus(provisionalUnit.status);
  }, [provisionalUnit?.id, provisionalUnit?.status]);

  const handleMediaSynced = React.useCallback((media: InventoryUnit["media"]) => {
    setLiveServerMedia(media);
  }, []);

  const dismissMobileUpload = React.useCallback(async () => {
    const unitId = effectiveUnit?.id;
    if (mobileSession) {
      try {
        await revokeInventoryMobileUploadSessionAction(mobileSession.sessionId);
      } catch {
        /* enlace expira solo */
      }
    }
    setMobileUploadOpen(false);
    setMobileSession(null);
    // No borrar liveServerMedia en frío: en modo "nuevo producto" `provisionalUnit` no trae medios
    // actualizados del servidor; al cerrar el panel las fotos solo vivían en liveServerMedia.
    if (unitId) {
      try {
        const snap = await getInventoryUnitMediaSnapshotAction(unitId);
        if (snap.ok) {
          setLiveServerMedia(snap.media);
        }
      } catch {
        /* mantener último liveServerMedia si el snapshot falla */
      }
    }
    router.refresh();
  }, [mobileSession, router, effectiveUnit?.id]);

  const startMobileUpload = React.useCallback(async () => {
    if (!allowMobileUpload || mobileBusy) return;
    setMobileBusy(true);
    setMobileSession(null);
    try {
      let targetId = effectiveUnit?.id;
      if (!targetId) {
        const draft = await ensureDraftProductUnitForMobileUploadAction();
        if (!draft.ok) {
          toast.error(draft.error);
          return;
        }
        setProvisionalUnit(draft.unit);
        targetId = draft.unit.id;
        router.refresh();
      }

      const sess = await createInventoryMobileUploadSessionAction(targetId);
      if (!sess.ok) {
        toast.error(sess.error);
        return;
      }
      setMobileSession(sess.data);
      setMobileUploadOpen(true);
    } finally {
      setMobileBusy(false);
    }
  }, [allowMobileUpload, mobileBusy, effectiveUnit?.id, router]);

  React.useEffect(() => {
    if (!dialogOpen) {
      setAccordionOpen([]);
    }
  }, [dialogOpen]);

  const photoPreviews = React.useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files]);

  React.useEffect(() => {
    return () => {
      photoPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [photoPreviews]);

  const persistDraft = React.useCallback(() => {
    if (!formRef.current) return;

    const draft = new FormData(formRef.current);
    const fields = Object.fromEntries(
      Array.from(draft.entries()).filter(
        ([, value]) => typeof value === "string",
      ) as Array<[string, string]>,
    );

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        fields,
        status,
        aiContext,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, [status, storageKey, aiContext]);

  React.useEffect(() => {
    if (!formRef.current) return;

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        fields?: Record<string, string>;
        status?: string;
        aiContext?: string;
      };

      if (typeof parsed.aiContext === "string") {
        setAiContext(parsed.aiContext);
      }

      if (parsed.fields) {
        for (const [name, value] of Object.entries(parsed.fields)) {
          const element = formRef.current.elements.namedItem(name);
          if (
            element &&
            "value" in element &&
            typeof element.value === "string" &&
            value
          ) {
            element.value = value;
          }
        }
      }

      if (parsed.status) {
        setStatus(parsed.status as typeof status);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (!formRef.current) return;
    persistDraft();
  }, [persistDraft]);

  const submit = (intent: "save-draft" | "save-product") => {
    if (!formRef.current) return;

    const photoLimitError = validateInventoryPhotoPayload(files);
    if (photoLimitError) {
      toast.error(photoLimitError);
      return;
    }

    const formData = new FormData(formRef.current);
    formData.set("intent", intent);
    formData.set("status", status);
    formData.set("aiContext", aiContext);
    files.forEach((file) => formData.append("photos", file));

    const useUpdatePath = Boolean(effectiveUnit?.id) && (mode === "edit" || provisionalUnit !== null);
    if (useUpdatePath && effectiveUnit) {
      formData.set("unitId", effectiveUnit.id);
    }

    startTransition(async () => {
      try {
        const result =
          useUpdatePath && effectiveUnit
            ? await updateProductUnitAction(formData)
            : await createProductUnitAction(formData);

        if (!result.ok) {
          toast.error(result.error || "No fue posible guardar el producto.");
          return;
        }

        window.localStorage.removeItem(storageKey);
        toast.success(useUpdatePath ? "Cambios guardados." : "Producto guardado.");
        onDone();
        router.refresh();
      } catch {
        toast.error("No fue posible guardar el producto. Verifica tu conexión e inténtalo de nuevo.");
      }
    });
  };

  const refreshAfterMedia = () => {
    router.refresh();
  };

  const runMediaAction = (action: () => Promise<{ ok: boolean; error?: string }>, okMessage: string) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error || "No se pudo completar la accion.");
        return;
      }
      toast.success(okMessage);
      refreshAfterMedia();
    });
  };

  const moveServerMedia = (orderedIds: string[], message: string) => {
    if (!effectiveUnit) return;
    const formData = new FormData();
    formData.set("unitId", effectiveUnit.id);
    formData.set("orderedIds", orderedIds.join(","));
    runMediaAction(() => reorderProductMediaAction(formData), message);
  };

  const sortedServerMedia = React.useMemo(() => {
    const source = liveServerMedia ?? effectiveUnit?.media;
    if (!source?.length) return [];
    return [...source].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [liveServerMedia, effectiveUnit?.media]);

  const hasPhotosForAi = files.length > 0 || sortedServerMedia.length > 0;

  const applyVisionToForm = React.useCallback((data: InventoryVisionResult) => {
    const form = formRef.current;
    if (!form) return;

    const setIfEmpty = (name: string, val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return;
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (!el.value.trim()) {
          el.value = trimmed;
        }
      }
    };

    setIfEmpty("title", data.suggestedTitle);
    setIfEmpty("brand", data.brand);
    setIfEmpty("model", data.model);
    setIfEmpty("category", data.category);
    setIfEmpty("condition", data.conditionEstimate);
    setIfEmpty("deviceType", data.deviceType || data.productType);
    setIfEmpty("ram", data.ram);
    setIfEmpty("ssd", data.ssd);
    setIfEmpty("cpu", data.cpu);
    setIfEmpty("color", data.color);

    const notesEl = form.elements.namedItem("notes");
    if (notesEl instanceof HTMLTextAreaElement) {
      const parts = [data.suggestedDescription, data.visibleNotes, data.publicationNotes, data.confidenceNote].filter(
        (p) => p.trim().length > 0,
      );
      if (!notesEl.value.trim() && parts.length) {
        notesEl.value = parts.join("\n\n");
      }
    }
  }, []);

  const runAiFill = () => {
    startAiTransition(async () => {
      const formData = new FormData();
      if (effectiveUnit?.id) {
        formData.set("unitId", effectiveUnit.id);
      }
      files.forEach((file) => formData.append("images", file));

      formData.set("userContext", aiContext);

      const hintKeys = ["title", "brand", "model", "category", "condition", "notes", "ram", "ssd", "cpu", "deviceType", "color"] as const;
      const hints: Record<string, string> = {};
      const form = formRef.current;
      if (form) {
        for (const key of hintKeys) {
          const el = form.elements.namedItem(key);
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            const v = el.value.trim();
            if (v) hints[key] = v;
          }
        }
      }
      formData.set("formHints", JSON.stringify(hints));

      const result = await analyzeInventoryProductPhotosAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      applyVisionToForm(result.data);
      setAccordionOpen([...INVENTORY_MODAL_ACCORDION_KEYS]);
      persistDraft();
      toast.success("IA aplicada en campos vacíos. Revisa antes de guardar.");
    });
  };

  return (
    <form ref={formRef} className="space-y-6 pb-4" onChangeCapture={persistDraft} onBlurCapture={persistDraft}>
      <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Fotos</CardTitle>
            <CardDescription>
              Imágenes de la unidad. Orden, foto principal y borrado desde cada miniatura.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allowMobileUpload ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Usa la cámara del teléfono sin cable: enlace seguro de un solo uso con QR.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 shrink-0 gap-2 rounded-2xl"
                  disabled={pending || mobileBusy}
                  onClick={() => void startMobileUpload()}
                >
                  {mobileBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
                  Subir desde mi teléfono
                </Button>
              </div>
            ) : null}
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/80 bg-background/60 p-6 text-center transition hover:bg-accent/30">
              <Camera className="mb-3 size-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Añadir fotos</span>
              <span className="mt-1 max-w-sm text-sm text-muted-foreground">
                {
                  "Al confirmar el producto con fotos, la unidad pasa a recibida. Puedes elegir varias a la vez o ir añadiendo de una en una; en iPhone cada nueva foto se suma a la lista."
                }
              </span>
              <input
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const input = event.currentTarget;
                  // Hay que copiar los File antes de vaciar el input: al poner value="" muchos navegadores vacían el FileList.
                  const picked = Array.from(input.files ?? []);
                  // Sin vaciar el input, iOS Safari a veces no vuelve a disparar onChange en la siguiente foto.
                  input.value = "";
                  if (!picked.length) return;
                  setFiles((prev) => [...prev, ...picked]);
                }}
              />
            </label>
            {photoPreviews.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photoPreviews.map((photo, index) => (
                  <div key={photo.url} className="space-y-2 rounded-2xl border border-border/60 bg-muted/40 p-2">
                    <InventoryMediaThumbnail src={photo.url} alt={photo.name} />
                    <p className="truncate px-1 text-xs text-muted-foreground">{photo.name}</p>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={pending || index === 0}
                        onClick={() => setFiles((prev) => {
                          const next = [...prev];
                          const item = next[index];
                          const prevItem = next[index - 1];
                          if (!item || !prevItem) return prev;
                          next[index - 1] = item;
                          next[index] = prevItem;
                          return next;
                        })}
                      >
                        <ChevronUp className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={pending || index === photoPreviews.length - 1}
                        onClick={() => setFiles((prev) => {
                          const next = [...prev];
                          const item = next[index];
                          const nextItem = next[index + 1];
                          if (!item || !nextItem) return prev;
                          next[index + 1] = item;
                          next[index] = nextItem;
                          return next;
                        })}
                      >
                        <ChevronDown className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg px-2 text-xs text-destructive"
                        disabled={pending}
                        onClick={() => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {effectiveUnit && sortedServerMedia.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sortedServerMedia.map((photo, index) => (
                  <div
                    key={photo.id}
                    className={cn(
                      "space-y-2 rounded-2xl border p-2",
                      photo.isPrimary ? "border-primary ring-1 ring-primary/40" : "border-border/60 bg-muted/40",
                    )}
                  >
                    <InventoryMediaThumbnail src={photo.fileUrl} alt={photo.fileName} />
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={pending || index === 0}
                        onClick={() => {
                          const ids = sortedServerMedia.map((item) => item.id);
                          const next = [...ids];
                          const current = next[index];
                          const prev = next[index - 1];
                          if (!current || !prev) return;
                          next[index - 1] = current;
                          next[index] = prev;
                          moveServerMedia(next, "Orden actualizado.");
                        }}
                      >
                        <ChevronUp className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={pending || index === sortedServerMedia.length - 1}
                        onClick={() => {
                          const ids = sortedServerMedia.map((item) => item.id);
                          const next = [...ids];
                          const current = next[index];
                          const after = next[index + 1];
                          if (!current || !after) return;
                          next[index + 1] = current;
                          next[index] = after;
                          moveServerMedia(next, "Orden actualizado.");
                        }}
                      >
                        <ChevronDown className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={photo.isPrimary ? "default" : "outline"}
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={pending || photo.isPrimary}
                        onClick={() => {
                          const formData = new FormData();
                          formData.set("unitId", effectiveUnit.id);
                          formData.set("mediaId", photo.id);
                          runMediaAction(() => setPrimaryProductMediaAction(formData), "Foto principal actualizada.");
                        }}
                      >
                        <Star className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg px-2 text-xs text-destructive"
                        disabled={pending}
                        onClick={() => {
                          const formData = new FormData();
                          formData.set("unitId", effectiveUnit.id);
                          formData.set("mediaId", photo.id);
                          runMediaAction(() => deleteProductMediaAction(formData), "Foto eliminada.");
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Asistente de IA</CardTitle>
            <CardDescription>
              Usa tu clave y modelo en Market Flow → Configuración. Hasta 4 imágenes por análisis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ukos-ai-context" className="text-sm font-medium text-foreground">
                Contexto para la IA
              </Label>
              <Textarea
                id="ukos-ai-context"
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                rows={4}
                className="min-h-[5.5rem] resize-y rounded-2xl text-sm"
                disabled={pending || aiPending}
              />
              <p className="text-xs text-muted-foreground">
                Lo que escribas aquí se guarda con la unidad y ayuda a acertar título y especificaciones.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-2xl gap-2 text-base"
              disabled={!hasPhotosForAi || pending || aiPending}
              onClick={runAiFill}
            >
              {aiPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
              {aiPending ? "Analizando…" : "Rellenar con IA"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Solo rellena campos vacíos. Revisa integraciones si la API falla.
            </p>
          </CardContent>
        </Card>
      </div>

      <Accordion
        className="space-y-4"
        multiple
        keepMounted
        value={accordionOpen}
        onValueChange={(next) => setAccordionOpen(next)}
      >
        <OverlayAccordion value="general" title="General">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título" name="title" defaultValue={titleForInventoryFormField(effectiveUnit?.title)} />
            <div className="space-y-2">
              <Label>Estado</Label>
              <p className="text-xs text-muted-foreground">
                En «Guardar borrador» eliges el estado manualmente. En «Guardar cambios» / «Guardar producto» se
                recalcula según título y campos obligatorios.
              </p>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger className="h-11 w-full min-w-0 rounded-2xl">
                  <SelectValue>{(value) => getProductUnitStatusLabel(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {productStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Marca" name="brand" defaultValue={effectiveUnit?.brand ?? ""} />
            <Field label="Modelo" name="model" defaultValue={effectiveUnit?.model ?? ""} />
            <Field label="Categoría" name="category" defaultValue={effectiveUnit?.category ?? ""} />
            <Field label="Condición" name="condition" defaultValue={effectiveUnit?.condition ?? ""} />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea id="notes" name="notes" defaultValue={effectiveUnit?.notes ?? ""} className="min-h-28 rounded-2xl" />
            </div>
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="specs" title="Especificaciones">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo de equipo" name="deviceType" defaultValue={getSpecValue(effectiveUnit, "Tipo De Equipo")} />
            <Field label="RAM" name="ram" defaultValue={getSpecValue(effectiveUnit, "RAM")} />
            <Field label="SSD" name="ssd" defaultValue={getSpecValue(effectiveUnit, "SSD")} />
            <Field label="CPU" name="cpu" defaultValue={getSpecValue(effectiveUnit, "CPU")} />
            <Field label="Color" name="color" defaultValue={getSpecValue(effectiveUnit, "Color")} />
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="costs" title="Costos">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Costo" name="costAmount" defaultValue={effectiveUnit?.costAmount ?? ""} type="number" />
            <Field label="Precio de venta" name="salePrice" defaultValue={effectiveUnit?.salePrice ?? ""} type="number" />
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="publications" title="Publicaciones">
          <div className="space-y-3">
            {!effectiveUnit?.publications.length && mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Al guardar se generan las publicaciones pendientes por cada canal activo.
              </p>
            ) : null}
            {effectiveUnit?.publications.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {effectiveUnit.publications.map((publication) => {
                  const isPublished = publication.status === "PUBLISHED";
                  return (
                    <div
                      key={publication.id}
                      className={cn(
                        "rounded-2xl border p-4",
                        isPublished
                          ? "border-emerald-500/50 bg-emerald-500/5"
                          : "border-amber-500/40 bg-amber-500/5",
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{publication.channel.displayName}</p>
                          <Badge className={isPublished ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-amber-600 text-white hover:bg-amber-600"}>
                            {isPublished ? "Publicado en este canal" : "Pendiente de publicar"}
                          </Badge>
                          {isPublished && publication.generatedTitle ? (
                            <p className="text-sm text-muted-foreground line-clamp-2">{publication.generatedTitle}</p>
                          ) : null}
                          {isPublished && publication.publishedPrice ? (
                            <p className="text-sm font-medium text-foreground">Precio publicado: ${publication.publishedPrice}</p>
                          ) : null}
                          {isPublished && publication.publishedAt ? (
                            <p className="text-xs text-muted-foreground">
                              Fecha: {formatUtcDateTime(publication.publishedAt)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/market-flow/publicar?publicacion=${publication.id}`}
                            className={cn(
                              buttonVariants({ variant: isPublished ? "outline" : "secondary" }),
                              "rounded-xl",
                            )}
                          >
                            {isPublished ? "Gestionar publicación" : "Ir a publicar"}
                          </Link>
                          {isPublished && publication.externalUrl ? (
                            <a
                              href={publication.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(buttonVariants({ variant: "outline" }), "rounded-xl inline-flex items-center gap-2")}
                            >
                              <ExternalLink className="size-4" />
                              Ver publicación externa
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="activity" title="Actividad">
          <div className="space-y-3">
            {(effectiveUnit?.activities ?? []).length ? (
              effectiveUnit?.activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <p className="font-medium text-foreground">{activity.label}</p>
                  <p className="text-sm text-muted-foreground">{formatUtcDateTime(activity.createdAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                Aún no hay movimientos registrados para esta unidad.
              </div>
            )}
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="leads" title="Leads">
          <div className="space-y-3">
            {(effectiveUnit?.leads ?? []).length ? (
              effectiveUnit?.leads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{lead.displayName}</p>
                      <p className="text-sm text-muted-foreground">Lead vinculado a esta unidad</p>
                    </div>
                    <Badge variant={lead.hasActiveConversation ? "default" : "outline"}>
                      {lead.hasActiveConversation ? "Conversación activa" : "Sin actividad"}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                No hay leads asociados a esta unidad. Crealos desde la vista Leads.
              </div>
            )}
          </div>
        </OverlayAccordion>
      </Accordion>

      <Separator />

      <div className={cn("sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border/60 bg-background/95 py-3 backdrop-blur lg:flex-row lg:justify-end")}>
        <Button type="button" variant="outline" className="h-12 rounded-2xl" disabled={pending} onClick={() => submit("save-draft")}>
          Guardar borrador
        </Button>
        <Button type="button" className="h-12 rounded-2xl px-6 text-base" disabled={pending} onClick={() => submit("save-product")}>
          {mode === "create" ? "Guardar producto" : "Guardar cambios"}
        </Button>
      </div>

      {effectiveUnit?.id ? (
        <InventoryMobileUploadPanel
          open={mobileUploadOpen}
          onDismiss={dismissMobileUpload}
          session={mobileSession}
          unitId={effectiveUnit.id}
          onMediaSynced={handleMediaSynced}
        />
      ) : null}
    </form>
  );
}

function OverlayAccordion({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="rounded-[1.5rem] border border-border/60 bg-card/90 px-4 shadow-sm">
      <AccordionTrigger className="text-base font-semibold">{title}</AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.name}>{label}</Label>
      <Input {...props} id={props.name} className="h-11 rounded-2xl" />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TruncatedTextWithTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className={cn("block w-full truncate", className)}>{text}</p>
      </TooltipTrigger>
      <TooltipContent className="max-w-[28rem] whitespace-normal break-words">{text}</TooltipContent>
    </Tooltip>
  );
}

function EmptyInventory() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border/60 bg-background/80 px-6 py-12 text-center">
      <PackagePlus className="size-8 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">Sin unidades aún</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Crea la primera unidad con fotos y datos mínimos para empezar a operar.
      </p>
    </div>
  );
}

const INVENTORY_MODAL_ACCORDION_KEYS = ["general", "specs", "costs", "publications", "activity", "leads"] as const;

function getSpecValue(unit: InventoryUnit | undefined | null, key: string) {
  return unit?.specs.find((spec) => spec.key === key)?.value ?? "";
}
