"use client";

import * as React from "react";
import JSZip from "jszip";
import { useRouter } from "next/navigation";
import { CheckCheck, Copy, Download, ExternalLink, Images, Loader2, Megaphone, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { InventoryMediaThumbnail } from "@/features/market-flow/inventory/inventory-media-thumbnail";
import { generatePublicationListingAction } from "@/features/market-flow/publish/publish-ai-actions";
import { markPublicationAsPublishedAction, savePublicationDraftAction } from "@/features/market-flow/publish/actions";
import { Badge } from "@/components/ui/badge";
import { inventoryUploadImageSrc } from "@/lib/inventory-upload-public-url";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PublishEntry = {
  id: string;
  status: string;
  generatedTitle: string | null;
  generatedDescription: string | null;
  suggestedPriceHigh: string | null;
  suggestedPriceMid: string | null;
  suggestedPriceLow: string | null;
  publishedPrice: string | null;
  externalUrl: string | null;
  publishedAt: Date | null;
  channel: {
    id: string;
    displayName: string;
    code: string;
  };
  unit: {
    id: string;
    number: string;
    title: string;
    status: string;
    costAmount: string | null;
    salePrice: string | null;
    notes: string | null;
    media: Array<{ id: string; fileUrl: string; fileName: string }>;
    specs: Array<{ id: string; key: string; value: string }>;
    publications: Array<{
      id: string;
      status: string;
      channel: { id: string; displayName: string; code: string };
    }>;
  };
};

type PublishPageProps = {
  entries: PublishEntry[];
  initialChannelId?: string | null;
};

function toLocalDateTimeInput(value: Date | string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parsePriceInput(value: string): number | null {
  const t = value.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function isValidHttpUrl(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** En iPhone/Safari el atributo download falla a menudo; Web Share permite Guardar imagen al carrete. */
async function saveImageBlobToDevice(blob: Blob, filename: string): Promise<"share_ok" | "share_aborted" | "anchor_ok"> {
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const file = new File([blob], filename, { type });

  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "share_ok";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return "share_aborted";
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  return "anchor_ok";
}

const channelAccent: Record<string, string> = {
  facebook_marketplace: "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20",
  offerup: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20",
  ebay: "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/20",
};

export function PublishPage({ entries, initialChannelId }: PublishPageProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, { channelId: string; channelName: string; code: string; entries: PublishEntry[] }>();

    for (const entry of entries) {
      const existing = map.get(entry.channel.id);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(entry.channel.id, {
          channelId: entry.channel.id,
          channelName: entry.channel.displayName,
          code: entry.channel.code,
          entries: [entry],
        });
      }
    }

    return Array.from(map.values());
  }, [entries]);

  const fallbackChannel = grouped[0]?.channelId ?? "";
  const [activeChannel, setActiveChannel] = React.useState(fallbackChannel);

  React.useEffect(() => {
    const preferred =
      initialChannelId && grouped.some((group) => group.channelId === initialChannelId)
        ? initialChannelId
        : fallbackChannel;
    setActiveChannel(preferred || "");
  }, [initialChannelId, fallbackChannel, grouped]);

  return (
    <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>Cola por canal</CardTitle>
        <CardDescription>
          Solo entran filas <strong className="text-foreground">pendientes de publicar</strong>. Al marcar como publicado, salen de esta cola pero siguen en{" "}
          <strong className="text-foreground">Inventario → Publicaciones</strong> (desde ahí puedes reabrir el mismo formulario).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {grouped.length ? (
          <Tabs value={activeChannel} onValueChange={setActiveChannel} className="gap-5">
            <TabsList className="h-auto min-h-11 w-full flex-wrap justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 sm:flex-nowrap">
              {grouped.map((group) => (
                <TabsTrigger
                  key={group.channelId}
                  value={group.channelId}
                  className={cn(
                    "shrink-0 rounded-lg border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap",
                    "text-muted-foreground shadow-none transition-colors",
                    "hover:bg-background/60 hover:text-foreground",
                    "data-active:border-border data-active:bg-background data-active:text-foreground data-active:shadow-sm",
                    "dark:data-active:bg-card",
                  )}
                >
                  {group.channelName}
                  <Badge
                    variant="secondary"
                    className="ml-2 border-border/60 bg-muted/80 text-foreground tabular-nums dark:bg-muted dark:text-foreground"
                  >
                    {group.entries.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {grouped.map((group) => (
              <TabsContent key={group.channelId} value={group.channelId} className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    {group.entries.map((entry) => (
                      <PublishEntryOverlay
                        key={entry.id}
                        entry={entry}
                        trigger={
                          <button className={`w-full rounded-[1.75rem] border p-4 text-left shadow-sm transition hover:translate-y-[-1px] ${channelAccent[entry.channel.code] || "border-border/60 bg-background/90"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{entry.unit.number}</p>
                                <h3 className="mt-1 text-base font-semibold text-foreground">{entry.unit.title}</h3>
                              </div>
                              <Badge variant={entry.status === "PUBLISHED" ? "default" : "secondary"}>
                              {entry.status === "PUBLISHED" ? "Publicado" : "Pendiente"}
                            </Badge>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              {entry.generatedTitle || entry.unit.title}
                            </p>
                            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                              <span>{entry.unit.salePrice ? `$${entry.unit.salePrice}` : "Precio Pendiente"}</span>
                              <span>{entry.unit.media.length} Fotos</span>
                            </div>
                          </button>
                        }
                      />
                    ))}
                  </div>
                  <div className="hidden xl:block rounded-[1.75rem] border border-dashed border-border/60 bg-background/80 p-8 text-center text-sm text-muted-foreground">
                    Selecciona una unidad pendiente para editar copy, ajustar precio y marcarla como publicada en este canal.
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border/60 bg-background/90 px-6 py-14 text-center">
            <Megaphone className="size-8 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Sin pendientes en la cola</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Las unidades ya marcadas como publicadas no se listan aquí: revisa el estado en{" "}
              <strong className="text-foreground">Inventario</strong>, abre la unidad y en{" "}
              <strong className="text-foreground">Publicaciones</strong> usa <strong className="text-foreground">Gestionar publicación</strong> para editar copy, precio o enlace.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const unitStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  RECEIVED: "Recibido",
  READY_TO_PUBLISH: "Por publicar",
  PUBLISHED: "Publicado",
  SOLD: "Vendido",
};

function PublishEntryOverlay({ entry, trigger }: { entry: PublishEntry; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const content = <PublishEntryForm key={entry.id} entry={entry} onDone={() => setOpen(false)} />;

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[94vh] w-[min(1120px,calc(100vw-1rem))] max-w-none flex-col rounded-[1.75rem] border-border/60 bg-background p-0 sm:h-[92vh] sm:w-[min(1100px,calc(100vw-2rem))] sm:rounded-[2rem]">
          <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-8 sm:py-6">
            <DialogTitle>{entry.channel.displayName}</DialogTitle>
            <DialogDescription>{entry.unit.number} · {entry.unit.title}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">{content}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PublishEntryForm({ entry, onDone }: { entry: PublishEntry; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [aiPending, startAiTransition] = React.useTransition();
  const [zipPending, setZipPending] = React.useState(false);
  const [singlePhotoDownloadId, setSinglePhotoDownloadId] = React.useState<string | null>(null);
  const [urlFieldError, setUrlFieldError] = React.useState(false);
  const externalUrlRef = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState(entry.generatedTitle || entry.unit.title);
  const [description, setDescription] = React.useState(
    entry.generatedDescription || entry.unit.notes || `${entry.unit.title}. Equipo revisado y listo para publicar.`,
  );
  const [publishedPrice, setPublishedPrice] = React.useState(entry.publishedPrice || entry.unit.salePrice || entry.suggestedPriceMid || "");
  const [suggestedHigh, setSuggestedHigh] = React.useState(entry.suggestedPriceHigh || entry.unit.salePrice || "");
  const [suggestedMid, setSuggestedMid] = React.useState(entry.suggestedPriceMid || entry.unit.salePrice || "");
  const [suggestedLow, setSuggestedLow] = React.useState(entry.suggestedPriceLow || "");
  const [externalUrl, setExternalUrl] = React.useState(entry.externalUrl || "");
  const [publishedAt, setPublishedAt] = React.useState("");

  React.useEffect(() => {
    setTitle(entry.generatedTitle || entry.unit.title);
    setDescription(
      entry.generatedDescription || entry.unit.notes || `${entry.unit.title}. Equipo revisado y listo para publicar.`,
    );
    setPublishedPrice(entry.publishedPrice || entry.unit.salePrice || entry.suggestedPriceMid || "");
    setSuggestedHigh(entry.suggestedPriceHigh || entry.unit.salePrice || "");
    setSuggestedMid(entry.suggestedPriceMid || entry.unit.salePrice || "");
    setSuggestedLow(entry.suggestedPriceLow || "");
    setExternalUrl(entry.externalUrl || "");
    setPublishedAt(entry.publishedAt ? toLocalDateTimeInput(entry.publishedAt) : toLocalDateTimeInput(new Date()));
  }, [
    entry.id,
    entry.generatedTitle,
    entry.generatedDescription,
    entry.suggestedPriceHigh,
    entry.suggestedPriceMid,
    entry.suggestedPriceLow,
    entry.publishedPrice,
    entry.externalUrl,
    entry.publishedAt,
    entry.unit.title,
    entry.unit.notes,
    entry.unit.salePrice,
    entry.unit.costAmount,
  ]);

  const downloadImagesZip = async () => {
    if (!entry.unit.media.length) {
      toast.info("Esta unidad no tiene fotos cargadas.");
      return;
    }

    setZipPending(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(entry.unit.number.replace(/[^\w\-]+/g, "_")) ?? zip;

      for (let index = 0; index < entry.unit.media.length; index += 1) {
        const photo = entry.unit.media[index];
        const response = await fetch(inventoryUploadImageSrc(photo.fileUrl));
        if (!response.ok) {
          throw new Error("No se pudo descargar una imagen");
        }
        const blob = await response.blob();
        const safeName = photo.fileName?.replace(/[^\w.\-]+/g, "_") || `foto-${index + 1}.jpg`;
        folder.file(safeName, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${entry.unit.number}-fotos.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP generado con las fotos de la unidad.");
    } catch {
      toast.error("No se pudo generar el ZIP. Revisa la conexion o vuelve a intentar.");
    } finally {
      setZipPending(false);
    }
  };

  const downloadSinglePhoto = async (photo: PublishEntry["unit"]["media"][number], index: number) => {
    setSinglePhotoDownloadId(photo.id);
    try {
      const response = await fetch(inventoryUploadImageSrc(photo.fileUrl));
      if (!response.ok) {
        throw new Error("fetch failed");
      }
      const blob = await response.blob();
      const safeName = photo.fileName?.replace(/[^\w.\-]+/g, "_") || `foto-${index + 1}.jpg`;
      const how = await saveImageBlobToDevice(blob, safeName);
      if (how === "share_ok") {
        toast.success("En iPhone: en la hoja de compartir elige Guardar imagen para el carrete, o Guardar en Archivos.");
      } else if (how === "share_aborted") {
        /* usuario cerro la hoja */
      } else {
        toast.success("Foto descargada.");
      }
    } catch {
      toast.error("No se pudo descargar la foto. Revisa la conexion o vuelve a intentar.");
    } finally {
      setSinglePhotoDownloadId(null);
    }
  };

  const saveDraft = () => {
    const formData = new FormData();
    formData.set("publicationId", entry.id);
    formData.set("generatedTitle", title);
    formData.set("generatedDescription", description);
    formData.set("suggestedPriceHigh", suggestedHigh);
    formData.set("suggestedPriceMid", suggestedMid);
    formData.set("suggestedPriceLow", suggestedLow);

    startTransition(async () => {
      const result = await savePublicationDraftAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No fue posible guardar el borrador de publicacion.");
        return;
      }

      toast.success("Borrador guardado en la base de datos.");
      router.refresh();
    });
  };

  const costNum = entry.unit.costAmount != null ? parsePriceInput(entry.unit.costAmount) : null;
  const publishedNum = parsePriceInput(publishedPrice);
  const minPublishedByPolicy =
    costNum != null && costNum > 0 ? Math.round(costNum * 1.3 * 100) / 100 : null;
  const publishedViolatesMargin =
    minPublishedByPolicy != null && publishedNum != null && publishedNum < minPublishedByPolicy;
  const publishedBelowCost =
    costNum != null && publishedNum != null && publishedNum < costNum;
  const externalUrlOk = isValidHttpUrl(externalUrl);

  const runPublicationAi = () => {
    const formData = new FormData();
    formData.set("publicationId", entry.id);
    formData.set("refreshKey", typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    startAiTransition(async () => {
      const result = await generatePublicationListingAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No se pudo generar el listado con IA.");
        return;
      }
      setTitle(result.data.listingTitle);
      setDescription(result.data.listingDescription);
      setSuggestedHigh(result.data.priceHigh);
      setSuggestedMid(result.data.priceMid);
      setSuggestedLow(result.data.priceLow);

      // Persistimos inmediatamente para evitar perder el contenido IA al publicar.
      const draftData = new FormData();
      draftData.set("publicationId", entry.id);
      draftData.set("generatedTitle", result.data.listingTitle);
      draftData.set("generatedDescription", result.data.listingDescription);
      draftData.set("suggestedPriceHigh", result.data.priceHigh);
      draftData.set("suggestedPriceMid", result.data.priceMid);
      draftData.set("suggestedPriceLow", result.data.priceLow);
      draftData.set("ukosSkipRevalidate", "1");
      const draftResult = await savePublicationDraftAction(draftData);

      if (!draftResult.ok) {
        toast.error(draftResult.error || "IA generada, pero no se pudo guardar el borrador.");
        return;
      }

      toast.success("Listado regenerado y guardado en borrador.");
    });
  };

  const markPublished = () => {
    const urlTrim = externalUrl.trim();
    if (!urlTrim || !isValidHttpUrl(urlTrim)) {
      setUrlFieldError(true);
      toast.error("Debes agregar la URL externa antes de marcar como publicado.");
      setTimeout(() => {
        externalUrlRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        externalUrlRef.current?.focus();
      }, 50);
      return;
    }
    setUrlFieldError(false);

    if (minPublishedByPolicy != null && publishedNum != null && publishedNum < minPublishedByPolicy) {
      toast.error(
        publishedBelowCost && costNum != null
          ? `El precio publicado no puede estar por debajo del costo (${costNum.toFixed(2)}). Minimo con margen 30%: ${minPublishedByPolicy.toFixed(2)}.`
          : `El precio publicado debe ser al menos 30% sobre el costo (minimo ${minPublishedByPolicy.toFixed(2)}).`,
      );
      return;
    }

    const formData = new FormData();
    formData.set("publicationId", entry.id);
    formData.set("generatedTitle", title);
    formData.set("generatedDescription", description);
    formData.set("suggestedPriceHigh", suggestedHigh);
    formData.set("suggestedPriceMid", suggestedMid);
    formData.set("suggestedPriceLow", suggestedLow);
    formData.set("publishedPrice", publishedPrice);
    formData.set("externalUrl", externalUrl);
    formData.set("publishedAt", publishedAt);

    startTransition(async () => {
      const result = await markPublicationAsPublishedAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No fue posible marcar la publicacion.");
        return;
      }

      const wasPublished = entry.status === "PUBLISHED";
      toast.success(
        wasPublished
          ? `Publicación actualizada en ${entry.channel.displayName}.`
          : `${entry.unit.number} marcado como publicado en ${entry.channel.displayName}.`,
      );
      onDone();
      router.refresh();
    });
  };

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado al portapapeles.`);
  };

  const pricingSectionRef = React.useRef<HTMLDivElement>(null);
  const firstPhoto = entry.unit.media[0];

  return (
    <div className="space-y-8 pb-28">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Artículo en venta</p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{entry.channel.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {entry.unit.number} · {entry.unit.title}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-2xl px-5"
          disabled={pending || aiPending}
          onClick={saveDraft}
        >
          Guardar borrador
        </Button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,440px)_minmax(280px,1fr)] xl:grid-cols-[minmax(0,460px)_minmax(320px,1fr)] xl:gap-14">
        <div className="space-y-8">

          {/* ── 1. FOTOS (primero) ── */}
          <section
            className={`rounded-2xl border-2 border-dashed p-4 sm:p-5 ${channelAccent[entry.channel.code] || "border-border/60 bg-muted/20"}`}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Fotos</p>
                <p className="text-xs text-muted-foreground">
                  {entry.unit.media.length}/10 · Descarga por foto o ZIP. La subida nueva es desde Inventario o móvil.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {entry.unit.media.map((photo, index) => (
                <div key={photo.id} className="relative">
                  <InventoryMediaThumbnail src={photo.fileUrl} alt={photo.fileName || `Foto ${index + 1}`} />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-2 right-2 z-10 size-9 rounded-full border border-border/50 bg-background/95 shadow-md backdrop-blur-sm hover:bg-background"
                    disabled={singlePhotoDownloadId === photo.id}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void downloadSinglePhoto(photo, index);
                    }}
                    aria-label={`Descargar foto ${index + 1}${photo.fileName ? `: ${photo.fileName}` : ""}`}
                  >
                    {singlePhotoDownloadId === photo.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )}
                  </Button>
                </div>
              ))}
            </div>
            {entry.unit.media.length === 0 ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">Aún no hay fotos en esta unidad.</p>
            ) : null}
            <Button
              variant="outline"
              className="mt-4 w-full rounded-2xl sm:w-auto"
              disabled={zipPending}
              onClick={() => void downloadImagesZip()}
            >
              {zipPending ? <Loader2 className="size-4 animate-spin" /> : <Images className="size-4" />}
              Descargar todas en ZIP
            </Button>
          </section>

          {/* ── 2. TÍTULO (con botón IA discreto) ── */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obligatorio</p>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`title-${entry.id}`}>Título</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-2xl px-3 text-xs gap-1"
                      disabled={aiPending || !entry.unit.media.length}
                      onClick={() => void runPublicationAi()}
                    >
                      {aiPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      {aiPending ? "Generando..." : "Generar con IA"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => copyText(title, "Titulo")}
                    >
                      <Copy className="size-4" />
                      Copiar
                    </Button>
                  </div>
                </div>
                <Input
                  id={`title-${entry.id}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-12 rounded-2xl text-base"
                  placeholder="Ej: Dell Latitude 5420 i5 11th Gen 8GB RAM SSD"
                />
              </div>

              {/* ── 3. DESCRIPCIÓN ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`description-${entry.id}`}>Descripción</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => copyText(description, "Descripcion")}
                  >
                    <Copy className="size-4" />
                    Copiar
                  </Button>
                </div>
                <Textarea
                  id={`description-${entry.id}`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-56 rounded-2xl text-base whitespace-pre-wrap"
                />
              </div>
            </div>
          </div>

          {/* ── PRECIO + CATEGORÍA ── */}
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Publicación</p>
            <div className="space-y-2">
              <Label htmlFor={`published-price-${entry.id}`}>Precio</Label>
              <Input
                id={`published-price-${entry.id}`}
                value={publishedPrice}
                onChange={(event) => setPublishedPrice(event.target.value)}
                className={cn(
                  "h-12 rounded-2xl text-base",
                  publishedViolatesMargin &&
                    "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-destructive/40",
                )}
              />
              {publishedViolatesMargin && minPublishedByPolicy != null ? (
                <p className="text-sm text-destructive">
                  {publishedBelowCost && costNum != null
                    ? `Por debajo del costo (${costNum.toFixed(2)}). Mínimo con margen 30%: ${minPublishedByPolicy.toFixed(2)}.`
                    : `Mínimo permitido (30% sobre costo): ${minPublishedByPolicy.toFixed(2)}.`}
                </p>
              ) : minPublishedByPolicy != null ? (
                <p className="text-xs text-muted-foreground">
                  Referencia política 30% sobre costo: {minPublishedByPolicy.toFixed(2)}.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <div className="flex min-h-12 items-center rounded-2xl border border-input bg-muted/40 px-4 text-sm text-muted-foreground">
                {entry.unit.specs.length
                  ? entry.unit.specs
                      .slice(0, 3)
                      .map((s) => `${s.key}: ${s.value}`)
                      .join(" · ")
                  : "Sin categoría en especificaciones"}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full rounded-2xl text-base lg:hidden"
            onClick={() => pricingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Siguiente
          </Button>

          {/* ── PRECIO SUGERIDO + URL + FECHA ── */}
          <div ref={pricingSectionRef}>
            <Card className="rounded-2xl border-border/60 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Precio sugerido y publicación</CardTitle>
                <CardDescription>Rango de precios, URL externa y fecha.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <PriceField label="Precio alto" value={suggestedHigh} onChange={setSuggestedHigh} />
                  <PriceField label="Precio medio" value={suggestedMid} onChange={setSuggestedMid} />
                  <PriceField label="Precio bajo" value={suggestedLow} onChange={setSuggestedLow} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`external-url-${entry.id}`}>
                    URL externa <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">Obligatoria para marcar como publicado.</p>
                  <div className="flex gap-2">
                    <Input
                      ref={externalUrlRef}
                      id={`external-url-${entry.id}`}
                      value={externalUrl}
                      onChange={(event) => {
                        setExternalUrl(event.target.value);
                        setUrlFieldError(false);
                      }}
                      placeholder="https://..."
                      className={cn(
                        "h-11 rounded-2xl",
                        (urlFieldError || (externalUrl.trim().length > 0 && !externalUrlOk)) &&
                          "border-destructive ring-2 ring-destructive/30",
                      )}
                      aria-invalid={urlFieldError || (externalUrl.trim().length > 0 && !externalUrlOk)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() =>
                        externalUrl ? window.open(externalUrl, "_blank") : toast.info("Agrega primero la URL externa.")
                      }
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  </div>
                  {urlFieldError && (
                    <p className="text-sm font-medium text-destructive">
                      Debes agregar la URL externa antes de marcar como publicado.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`published-at-${entry.id}`}>Fecha de publicación</Label>
                  <Input
                    id={`published-at-${entry.id}`}
                    type="datetime-local"
                    value={publishedAt}
                    onChange={(event) => setPublishedAt(event.target.value)}
                    className="h-11 rounded-2xl"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── CONTEXTO DEL CANAL ── */}
          <Card className={`rounded-2xl border shadow-sm ${channelAccent[entry.channel.code] || "border-border/60 bg-card/90"}`}>
            <CardHeader>
              <CardTitle className="text-base">Contexto del canal</CardTitle>
              <CardDescription>{entry.channel.displayName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Estado:{" "}
                <strong className="text-foreground">{unitStatusLabels[entry.unit.status] ?? entry.unit.status}</strong>
              </p>
              <p>
                Costo:{" "}
                <strong className="text-foreground">{entry.unit.costAmount ? `$${entry.unit.costAmount}` : "Pendiente"}</strong>
              </p>
              <p>
                Precio venta objetivo:{" "}
                <strong className="text-foreground">{entry.unit.salePrice ? `$${entry.unit.salePrice}` : "Pendiente"}</strong>
              </p>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="font-medium text-foreground">Especificaciones</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.unit.specs.map((spec) => (
                    <Badge key={spec.id} variant="outline">
                      {spec.key}: {spec.value}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 lg:pl-2">
          <div className="lg:sticky lg:top-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa</p>
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-md">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <div className="relative aspect-square bg-muted">
                  {firstPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- misma URL pública que miniaturas
                    <img
                      src={inventoryUploadImageSrc(firstPhoto.fileUrl)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Vista previa de la publicación: añade fotos en inventario para ver la imagen aquí.
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 border-t border-border/60 p-4 sm:border-t-0 sm:border-l">
                  <p className="line-clamp-2 text-base font-bold leading-tight text-foreground">
                    {title.trim() || entry.unit.title}
                  </p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {publishedPrice.trim() ? `$${publishedPrice.trim()}` : "Precio pendiente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Publicado hace unos segundos · {entry.channel.displayName}
                  </p>
                  <div className="border-t border-border/50 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalles</p>
                    <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>
                  </div>
                  <Button type="button" variant="secondary" className="mt-2 h-10 cursor-default rounded-xl opacity-70" disabled>
                    Enviar mensaje
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border/60 bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:flex-row lg:justify-end">
        <Button type="button" variant="outline" className="h-12 rounded-2xl" disabled={pending || aiPending} onClick={saveDraft}>
          Guardar borrador del canal
        </Button>
        <Button
          type="button"
          className="h-12 rounded-2xl px-6 text-base"
          disabled={pending || aiPending}
          onClick={markPublished}
        >
          <CheckCheck className="size-4" />
          {entry.status === "PUBLISHED" ? "Actualizar publicación" : "Marcar como publicado"}
        </Button>
      </div>
    </div>
  );
}

function PriceField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl" />
    </div>
  );
}
