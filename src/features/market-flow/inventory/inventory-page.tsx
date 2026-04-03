"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, ChevronUp, ExternalLink, Loader2, PackagePlus, Search, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChannelIndicators } from "@/components/channel-indicators";
import { StatusBadge, productStatusOptions } from "@/components/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { analyzeInventoryProductPhotosAction } from "@/features/market-flow/inventory/ai-actions";
import { createProductUnitAction, updateProductUnitAction } from "@/features/market-flow/inventory/actions";
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
  { label: "Listo para publicar", value: "READY_TO_PUBLISH" },
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
};

type ProductOverlayProps = {
  mode: "create" | "edit";
  unit?: InventoryUnit;
  trigger?: React.ReactNode;
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

export function InventoryPage({ units, initialStatus, canCreate = true, canEdit = true }: InventoryPageProps) {
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
          <ResponsiveInventory units={filteredUnits} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}

function ResponsiveInventory({ units, canEdit }: { units: InventoryUnit[]; canEdit: boolean }) {
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
        {units.map((unit) =>
          canEdit ? (
            <ProductOverlay
              key={unit.id}
              mode="edit"
              unit={unit}
              trigger={
                <button
                  type="button"
                  className="w-full rounded-[1.75rem] border border-border/60 bg-background/90 p-4 text-left shadow-sm transition hover:border-border hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{unit.number}</p>
                      <h3 className="mt-1 text-base font-semibold text-foreground">{unit.title}</h3>
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
                        status: publication.status,
                      }))}
                    />
                  </div>
                </button>
              }
            />
          ) : (
            <div
              key={unit.id}
              className="w-full rounded-[1.75rem] border border-border/60 bg-background/90 p-4 text-left shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{unit.number}</p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">{unit.title}</h3>
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
                    status: publication.status,
                  }))}
                />
              </div>
            </div>
          ),
        )}
        {!units.length ? <EmptyInventory /> : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/90">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numero</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead>Precio De Venta</TableHead>
            <TableHead>Fecha De Registro</TableHead>
            <TableHead>Canales</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((unit) => (
            <TableRow key={unit.id}>
              <TableCell className="font-medium text-foreground">{unit.number}</TableCell>
              <TableCell>
                {canEdit ? (
                  <ProductOverlay
                    mode="edit"
                    unit={unit}
                    trigger={
                      <button type="button" className="text-left transition hover:text-primary">
                        <p className="font-semibold text-foreground">{unit.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {[unit.brand, unit.model].filter(Boolean).join(" / ") || "Unidad En Captura"}
                        </p>
                      </button>
                    }
                  />
                ) : (
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{unit.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[unit.brand, unit.model].filter(Boolean).join(" / ") || "Unidad En Captura"}
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
                    status: publication.status,
                  }))}
                />
              </TableCell>
            </TableRow>
          ))}
          {!units.length ? (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyInventory />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function ProductOverlay({ mode, unit, trigger }: ProductOverlayProps) {
  const [open, setOpen] = React.useState(false);

  const content = (
    <ProductOverlayContent
      mode={mode}
      unit={unit}
      dialogOpen={open}
      onDone={() => {
        setOpen(false);
      }}
    />
  );

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger ?? <Button>Nuevo Producto</Button>}</span>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[94vh] w-[min(1120px,calc(100vw-1rem))] max-w-none flex-col rounded-[1.75rem] border-border/60 bg-background p-0 sm:h-[92vh] sm:w-[min(1100px,calc(100vw-2rem))] sm:rounded-[2rem]">
        <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-8 sm:py-6">
          <DialogTitle className="text-2xl">{mode === "create" ? "Nuevo Producto" : unit?.title}</DialogTitle>
          <DialogDescription>
            Captura y mantenimiento de la unidad fisica: fotos, datos, costos y estado por canal.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">{content}</div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ProductOverlayContent({
  mode,
  unit,
  dialogOpen,
  onDone,
}: {
  mode: "create" | "edit";
  unit?: InventoryUnit;
  dialogOpen: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [aiPending, startAiTransition] = React.useTransition();
  const [files, setFiles] = React.useState<File[]>([]);
  const [status, setStatus] = React.useState(unit?.status ?? "DRAFT");
  const [draftRestored, setDraftRestored] = React.useState(false);
  const [aiContext, setAiContext] = React.useState("");
  const [accordionOpen, setAccordionOpen] = React.useState<string[]>([]);
  const [autosaveLabel, setAutosaveLabel] = React.useState<string | null>(null);
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const storageKey = React.useMemo(
    () => `market-flow-product-draft:${mode}:${unit?.id ?? "new"}`,
    [mode, unit?.id],
  );

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

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      setAutosaveLabel("Guardado automáticamente");
    }, 400);
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

      setDraftRestored(true);
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

    const maxTotalBytes = 14 * 1024 * 1024;
    const photoBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (photoBytes > maxTotalBytes) {
      toast.error(
        "Las fotos superan el tamaño máximo permitido (14 MB en total). Reduce el número de imágenes o comprímelas e inténtalo de nuevo.",
      );
      return;
    }

    const formData = new FormData(formRef.current);
    formData.set("intent", intent);
    formData.set("status", status);
    files.forEach((file) => formData.append("photos", file));
    if (mode === "edit" && unit) {
      formData.set("unitId", unit.id);
    }

    startTransition(async () => {
      try {
        const result = mode === "create" ? await createProductUnitAction(formData) : await updateProductUnitAction(formData);

        if (!result.ok) {
          toast.error(result.error || "No fue posible guardar el producto.");
          return;
        }

        window.localStorage.removeItem(storageKey);
        setAutosaveLabel(null);
        toast.success(mode === "create" ? "Producto guardado correctamente." : "Producto actualizado correctamente.");
        onDone();
        router.refresh();
      } catch {
        toast.error(
          "No fue posible guardar el producto. Si subiste fotos muy grandes, prueba con imágenes más pequeñas o menos archivos.",
        );
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
    if (!unit) return;
    const formData = new FormData();
    formData.set("unitId", unit.id);
    formData.set("orderedIds", orderedIds.join(","));
    runMediaAction(() => reorderProductMediaAction(formData), message);
  };

  const sortedServerMedia = React.useMemo(() => {
    if (!unit?.media.length) return [];
    return [...unit.media].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [unit]);

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
      if (mode === "edit" && unit?.id) {
        formData.set("unitId", unit.id);
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
      toast.success("Sugerencias de IA aplicadas en campos vacíos. Revisa y ajusta antes de guardar.");
    });
  };

  return (
    <form ref={formRef} className="space-y-6 pb-4" onChangeCapture={persistDraft} onBlurCapture={persistDraft}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        {autosaveLabel ? <p className="text-xs text-muted-foreground">{autosaveLabel}</p> : <span />}
        {draftRestored ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Borrador local recuperado. Si faltan fotos en pantalla, vuelve a seleccionarlas antes de guardar.
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Fotos</CardTitle>
            <CardDescription>
              Sube imagenes reales de la unidad. Puedes ordenarlas, marcar la principal y eliminar las que no sirvan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/80 bg-background/60 p-6 text-center transition hover:bg-accent/30">
              <Camera className="mb-3 size-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Subir fotos</span>
              <span className="mt-1 text-sm text-muted-foreground">
                Minimo una foto para salir del borrador. Puedes anadir mas despues de guardar.
              </span>
              <input
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
            </label>
            {photoPreviews.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photoPreviews.map((photo, index) => (
                  <div key={photo.url} className="space-y-2 rounded-2xl border border-border/60 bg-muted/40 p-2">
                    <div className="overflow-hidden rounded-xl">
                      <Image src={photo.url} alt={photo.name} width={320} height={112} unoptimized className="h-28 w-full object-cover" />
                    </div>
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
            {unit && sortedServerMedia.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sortedServerMedia.map((photo, index) => (
                  <div
                    key={photo.id}
                    className={cn(
                      "space-y-2 rounded-2xl border p-2",
                      photo.isPrimary ? "border-primary ring-1 ring-primary/40" : "border-border/60 bg-muted/40",
                    )}
                  >
                    <div className="overflow-hidden rounded-xl">
                      <Image src={photo.fileUrl} alt={photo.fileName} width={320} height={112} unoptimized className="h-28 w-full object-cover" />
                    </div>
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
                          formData.set("unitId", unit.id);
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
                          formData.set("unitId", unit.id);
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
              OpenAI analiza las fotos y el contexto que indiques. La clave y el modelo están en Configuraciones del Market Flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ukos-ai-context" className="text-sm font-medium text-foreground">
                Contexto adicional para la IA
              </Label>
              <Textarea
                id="ukos-ai-context"
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder="Ej. Dell Latitude 5420, i5 10.ª gen, 16 GB RAM, sin cargador, teclado en inglés…"
                rows={4}
                className="min-h-[5.5rem] resize-y rounded-2xl text-sm"
                disabled={pending || aiPending}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Escribe lo que ya sepas del producto: marca, modelo, estado, accesorios o limitaciones. La IA lo combina con la imagen y con lo que ya tengas en el formulario para sugerir mejores títulos y campos.
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
              {aiPending ? "Analizando con IA…" : "Rellenar con IA"}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Hasta 4 imágenes (nuevas o ya guardadas en esta unidad). Solo completa campos vacíos; no borra lo que escribiste. Si la API falla, revisa integraciones.
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
            <Field label="Titulo Del Producto" name="title" defaultValue={unit?.title ?? ""} placeholder="Ej. Dell Latitude 5420 16GB / 512GB" />
            <div className="space-y-2">
              <Label>Estado Visible</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger className="h-11 rounded-2xl">
                  <SelectValue placeholder="Selecciona Estado" />
                </SelectTrigger>
                <SelectContent>
                  {productStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Marca" name="brand" defaultValue={unit?.brand ?? ""} placeholder="Dell" />
            <Field label="Modelo" name="model" defaultValue={unit?.model ?? ""} placeholder="Latitude 5420" />
            <Field label="Categoria" name="category" defaultValue={unit?.category ?? ""} placeholder="Laptop" />
            <Field label="Condicion" name="condition" defaultValue={unit?.condition ?? ""} placeholder="Muy Buena" />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" defaultValue={unit?.notes ?? ""} placeholder="Observaciones operativas, upgrades o detalles importantes." className="min-h-28 rounded-2xl" />
            </div>
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="specs" title="Especificaciones">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo De Equipo" name="deviceType" defaultValue={getSpecValue(unit, "Tipo De Equipo")} placeholder="Laptop" />
            <Field label="RAM" name="ram" defaultValue={getSpecValue(unit, "RAM")} placeholder="16GB" />
            <Field label="SSD" name="ssd" defaultValue={getSpecValue(unit, "SSD")} placeholder="512GB" />
            <Field label="CPU" name="cpu" defaultValue={getSpecValue(unit, "CPU")} placeholder="Intel Core i5" />
            <Field label="Color" name="color" defaultValue={getSpecValue(unit, "Color")} placeholder="Gris espacial" />
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="costs" title="Costos">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Costo" name="costAmount" defaultValue={unit?.costAmount ?? ""} placeholder="320.00" type="number" />
            <Field label="Precio De Venta" name="salePrice" defaultValue={unit?.salePrice ?? ""} placeholder="480.00" type="number" />
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="publications" title="Publicaciones">
          <div className="space-y-3">
            {!unit?.publications.length && mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Al guardar el producto se crean las filas por cada canal activo de la empresa.
              </p>
            ) : null}
            {unit?.publications.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {unit.publications.map((publication) => {
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
                        </div>
                        <div className="flex flex-col gap-2">
                          {!isPublished ? (
                            <Link
                              href={`/market-flow/publicar?canal=${publication.channel.id}`}
                              className={cn(buttonVariants({ variant: "secondary" }), "rounded-xl")}
                            >
                              Ir a publicar
                            </Link>
                          ) : null}
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
            {(unit?.activities ?? []).length ? (
              unit?.activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <p className="font-medium text-foreground">{activity.label}</p>
                  <p className="text-sm text-muted-foreground">{formatUtcDateTime(activity.createdAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                Aun no hay movimientos registrados para esta unidad.
              </div>
            )}
          </div>
        </OverlayAccordion>

        <OverlayAccordion value="leads" title="Leads">
          <div className="space-y-3">
            {(unit?.leads ?? []).length ? (
              unit?.leads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{lead.displayName}</p>
                      <p className="text-sm text-muted-foreground">Lead vinculado a esta unidad</p>
                    </div>
                    <Badge variant={lead.hasActiveConversation ? "default" : "outline"}>
                      {lead.hasActiveConversation ? "Conversacion Activa" : "Sin Actividad"}
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
          Guardar Borrador
        </Button>
        <Button type="button" className="h-12 rounded-2xl px-6 text-base" disabled={pending} onClick={() => submit("save-product")}>
          {mode === "create" ? "Guardar Producto" : "Guardar Cambios"}
        </Button>
      </div>
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

function EmptyInventory() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border/60 bg-background/80 px-6 py-12 text-center">
      <PackagePlus className="size-8 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">Sin Unidades Aun</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Crea la primera unidad con fotos y datos minimos para empezar a operar.
      </p>
    </div>
  );
}

const INVENTORY_MODAL_ACCORDION_KEYS = ["general", "specs", "costs", "publications", "activity", "leads"] as const;

function getSpecValue(unit: InventoryUnit | undefined, key: string) {
  return unit?.specs.find((spec) => spec.key === key)?.value ?? "";
}
