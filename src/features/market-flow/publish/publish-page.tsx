"use client";

import * as React from "react";
import Image from "next/image";
import JSZip from "jszip";
import { useRouter } from "next/navigation";
import { CheckCheck, Copy, Download, ExternalLink, Images, Loader2, Megaphone, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generatePublicationListingAction } from "@/features/market-flow/publish/publish-ai-actions";
import { markPublicationAsPublishedAction, savePublicationDraftAction } from "@/features/market-flow/publish/actions";
import { Badge } from "@/components/ui/badge";
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
          Cada unidad pendiente aparece una vez por canal. Los datos se guardan en la base al usar los botones inferiores.
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
                              <Badge variant="secondary">Pendiente</Badge>
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
            <h3 className="mt-4 text-lg font-semibold">Sin Pendientes Por Publicar</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Cuando una unidad pase a Listo Para Publicar y aun no este marcada en un canal, aparecera aqui automaticamente.
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
  READY_TO_PUBLISH: "Listo para publicar",
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
        const response = await fetch(photo.fileUrl);
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
      const response = await fetch(photo.fileUrl);
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
      const draftResult = await savePublicationDraftAction(draftData);

      if (!draftResult.ok) {
        toast.error(draftResult.error || "IA generada, pero no se pudo guardar el borrador.");
        return;
      }

      toast.success("Listado regenerado y guardado en borrador.");
    });
  };

  const markPublished = () => {
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

      toast.success(`${entry.unit.number} marcado como publicado en ${entry.channel.displayName}.`);
      onDone();
    });
  };

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado al portapapeles.`);
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Fotos de la unidad</CardTitle>
            <CardDescription>Boton en cada foto para descargar; ZIP para todas. En iPhone: compartir → Guardar imagen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {entry.unit.media.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/40"
                >
                  <Image
                    src={photo.fileUrl}
                    alt={photo.fileName || `Foto ${index + 1} de la unidad`}
                    width={320}
                    height={160}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-1.5 right-1.5 z-10 size-9 rounded-full border border-border/50 bg-background/95 shadow-md backdrop-blur-sm hover:bg-background"
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
            <Button variant="outline" className="rounded-2xl" disabled={zipPending} onClick={() => void downloadImagesZip()}>
              {zipPending ? <Loader2 className="size-4 animate-spin" /> : <Images className="size-4" />}
              Descargar fotos (ZIP)
            </Button>
          </CardContent>
        </Card>

        <Card className={`rounded-[1.75rem] border shadow-sm ${channelAccent[entry.channel.code] || "border-border/60 bg-card/90"}`}>
          <CardHeader>
            <CardTitle className="text-lg">Contexto del canal</CardTitle>
            <CardDescription>{entry.channel.displayName} · {entry.unit.number}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Estado de la unidad:{" "}
              <strong className="text-foreground">{unitStatusLabels[entry.unit.status] ?? entry.unit.status}</strong>
            </p>
            <p>Costo actual: <strong className="text-foreground">{entry.unit.costAmount ? `$${entry.unit.costAmount}` : "Pendiente"}</strong></p>
            <p>Precio de venta objetivo: <strong className="text-foreground">{entry.unit.salePrice ? `$${entry.unit.salePrice}` : "Pendiente"}</strong></p>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <p className="font-medium text-foreground">Especificaciones</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.unit.specs.map((spec) => (
                  <Badge key={spec.id} variant="outline">{spec.key}: {spec.value}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg">Texto para el canal</CardTitle>
              <CardDescription>
                Edita a mano o regenera con IA (cada clic vuelve a generar todo). Borrador guarda titulo y descripcion.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-10 shrink-0 rounded-2xl sm:mt-0"
              disabled={aiPending || !entry.unit.media.length}
              onClick={() => void runPublicationAi()}
            >
              {aiPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generar con IA
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!entry.unit.media.length ? (
              <p className="text-xs text-muted-foreground">Necesitas al menos una foto en la unidad para usar IA.</p>
            ) : null}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`title-${entry.id}`}>Titulo</Label>
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => copyText(title, "Titulo")}>
                  <Copy className="size-4" />
                  Copiar titulo
                </Button>
              </div>
              <Input id={`title-${entry.id}`} value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`description-${entry.id}`}>Descripcion</Label>
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => copyText(description, "Descripcion")}>
                  <Copy className="size-4" />
                  Copiar descripcion
                </Button>
              </div>
              <Textarea
                id={`description-${entry.id}`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-64 rounded-2xl whitespace-pre-wrap"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Precio y datos de publicacion</CardTitle>
            <CardDescription>Rango sugerido editable y campos finales al marcar como publicado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <PriceField label="Precio Alto" value={suggestedHigh} onChange={setSuggestedHigh} />
              <PriceField label="Precio Medio" value={suggestedMid} onChange={setSuggestedMid} />
              <PriceField label="Precio Bajo" value={suggestedLow} onChange={setSuggestedLow} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`published-price-${entry.id}`}>Precio Publicado</Label>
              <Input
                id={`published-price-${entry.id}`}
                value={publishedPrice}
                onChange={(event) => setPublishedPrice(event.target.value)}
                className={cn(
                  "h-11 rounded-2xl",
                  publishedViolatesMargin &&
                    "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-destructive/40",
                )}
              />
              {publishedViolatesMargin && minPublishedByPolicy != null ? (
                <p className="text-sm text-destructive">
                  {publishedBelowCost && costNum != null
                    ? `Por debajo del costo (${costNum.toFixed(2)}). Politica minima: 30% sobre costo (al menos ${minPublishedByPolicy.toFixed(2)}).`
                    : `Debe ser al menos 30% sobre el costo. Minimo permitido: ${minPublishedByPolicy.toFixed(2)}.`}
                </p>
              ) : minPublishedByPolicy != null ? (
                <p className="text-xs text-muted-foreground">
                  Politica: precio publicado ≥ 30% sobre costo (referencia {minPublishedByPolicy.toFixed(2)}).
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`external-url-${entry.id}`}>URL Externa</Label>
              <div className="flex gap-2">
                <Input id={`external-url-${entry.id}`} value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://..." className="h-11 rounded-2xl" />
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => externalUrl ? window.open(externalUrl, "_blank") : toast.info("Agrega primero la URL externa.") }>
                  <ExternalLink className="size-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`published-at-${entry.id}`}>Fecha De Publicacion</Label>
              <Input id={`published-at-${entry.id}`} type="datetime-local" value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} className="h-11 rounded-2xl" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border/60 bg-background/95 py-3 backdrop-blur lg:flex-row lg:justify-end">
        <Button type="button" variant="outline" className="h-12 rounded-2xl" disabled={pending || aiPending} onClick={saveDraft}>
          Guardar borrador del canal
        </Button>
        <Button
          type="button"
          className="h-12 rounded-2xl px-6 text-base"
          disabled={pending || aiPending || (publishedViolatesMargin && publishedNum != null)}
          onClick={markPublished}
        >
          <CheckCheck className="size-4" />
          Marcar como publicado
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
