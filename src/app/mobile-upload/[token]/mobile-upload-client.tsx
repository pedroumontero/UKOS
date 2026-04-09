"use client";

import * as React from "react";
import { CheckCircle2, ImagePlus, Loader2, RefreshCw, XCircle } from "lucide-react";

import { prepareImageFileForMobileUpload } from "@/lib/mobile-photo-prepare";
import { Button } from "@/components/ui/button";

type SessionInfo = {
  ok: true;
  title: string;
  number: string;
  expiresAt: string;
};

type FilePhase = "pending" | "preparing" | "uploading" | "done" | "error";

type FileItem = {
  id: string;
  name: string;
  phase: FilePhase;
  error?: string;
};

const MAX_RETRIES = 3;
const RETRY_MS = [800, 2000, 4500];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postSinglePhoto(token: string, file: File, signal: AbortSignal): Promise<void> {
  const formData = new FormData();
  formData.append("photos", file);
  const res = await fetch(`/api/inventory/mobile-upload/${encodeURIComponent(token)}`, {
    method: "POST",
    body: formData,
    signal,
  });
  let data: { ok?: boolean; error?: string } = {};
  try {
    const text = await res.text();
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    data = {};
  }
  if (!res.ok || data.ok !== true) {
    const msg = data.error || `Error ${res.status}`;
    throw new Error(msg);
  }
}

export function MobileInventoryUploadClient({ token }: { token: string }) {
  const [session, setSession] = React.useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<
    "idle" | "preparing" | "uploading" | "processing" | "saving" | "done" | "error"
  >("idle");
  const [items, setItems] = React.useState<FileItem[]>([]);
  const [doneCount, setDoneCount] = React.useState(0);
  const [totalPlanned, setTotalPlanned] = React.useState(0);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [wasHidden, setWasHidden] = React.useState(false);

  const abortRef = React.useRef<AbortController | null>(null);
  const runIdRef = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inventory/mobile-upload/${encodeURIComponent(token)}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json()) as SessionInfo | { ok: false; error?: string };
        if (cancelled) return;
        if (!res.ok || !("ok" in data) || data.ok !== true) {
          setLoadError("ok" in data && data.ok === false && data.error ? data.error : "No se pudo abrir el enlace.");
          return;
        }
        setSession(data);
      } catch {
        if (!cancelled) {
          setLoadError("Sin conexión o el servidor no respondió.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        setWasHidden(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const busy = phase === "preparing" || phase === "uploading" || phase === "processing" || phase === "saving";

  const runQueue = async (filesInput: File[]) => {
    const runId = ++runIdRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const raw = Array.from(filesInput).filter((f) => f.size > 0);
    if (!raw.length) return;

    setGlobalError(null);
    setDoneCount(0);
    setTotalPlanned(raw.length);
    setPhase("preparing");

    const nextItems: FileItem[] = raw.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      phase: "pending" as const,
    }));
    setItems(nextItems);

    const prepared: File[] = [];
    for (let i = 0; i < raw.length; i += 1) {
      if (runId !== runIdRef.current) return;
      const id = nextItems[i]!.id;
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, phase: "preparing" } : it)));
      try {
        const out = await prepareImageFileForMobileUpload(raw[i]!);
        prepared.push(out);
      } catch {
        prepared.push(raw[i]!);
      }
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, phase: "pending" } : it)));
    }

    if (runId !== runIdRef.current) return;
    setPhase("uploading");

    let uploaded = 0;
    let hadError = false;

    for (let i = 0; i < prepared.length; i += 1) {
      if (runId !== runIdRef.current) return;
      const id = nextItems[i]!.id;
      const file = prepared[i]!;

      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, phase: "uploading", error: undefined } : it)));
      setPhase("uploading");

      let lastErr = "Error de red";
      let ok = false;
      for (let attempt = 0; attempt < MAX_RETRIES && !ok; attempt += 1) {
        if (runId !== runIdRef.current) return;
        try {
          if (attempt > 0) {
            setPhase("processing");
            await sleep(RETRY_MS[attempt - 1] ?? 2000);
          }
          await postSinglePhoto(token, file, ac.signal);
          ok = true;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (e instanceof Error && e.name === "AbortError") {
            lastErr = "Subida cancelada.";
            break;
          }
        }
      }

      if (!ok) {
        hadError = true;
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, phase: "error", error: lastErr } : it)));
        setGlobalError("Algunas fotos no se subieron. Vuelve a elegir solo las que marcan error.");
        setPhase("error");
      } else {
        uploaded += 1;
        setDoneCount(uploaded);
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, phase: "done" } : it)));
      }
    }

    if (runId !== runIdRef.current) return;

    setPhase("saving");
    await sleep(250);

    if (runId !== runIdRef.current) return;

    if (!hadError) {
      setPhase("done");
      window.setTimeout(() => {
        if (runId === runIdRef.current) {
          setPhase("idle");
          setItems([]);
          setTotalPlanned(0);
          setDoneCount(0);
        }
      }, 2800);
    } else {
      setPhase("error");
    }
  };

  const onFilesPicked = (list: FileList | File[] | null) => {
    if (!list?.length) return;
    void runQueue(Array.from(list));
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const progressPct = totalPlanned > 0 ? Math.round((doneCount / totalPlanned) * 100) : 0;

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5 py-10">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <XCircle className="mx-auto size-10 text-destructive" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-foreground">Enlace no disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        </div>
        <p className="text-center text-xs text-muted-foreground">UKOS · Subida móvil de inventario</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Cargando enlace seguro…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">UKOS</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Subir fotos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.number} · {session.title}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Vence:{" "}
          {new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(session.expiresAt))}
        </p>
      </header>

      {wasHidden && phase === "error" ? (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Si cambiaste de app durante la subida, vuelve a elegir las fotos que fallaron.
        </div>
      ) : null}

      <div className="mb-5 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          {phase === "idle" && "Listo para recibir fotos"}
          {phase === "preparing" && "Optimizando imágenes…"}
          {phase === "uploading" && (totalPlanned ? `Subiendo ${Math.min(doneCount + 1, totalPlanned)} de ${totalPlanned} fotos…` : "Subiendo…")}
          {phase === "processing" && "Reintentando subida…"}
          {phase === "saving" && "Guardando fotos…"}
          {phase === "done" && "Todo listo"}
          {phase === "error" && "Revisa los errores abajo"}
        </p>
        {totalPlanned > 0 ? (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {doneCount}/{totalPlanned} completadas · {progressPct}%
            </p>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFilesPicked(e.currentTarget.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFilesPicked(e.currentTarget.files)}
        />

        <Button
          type="button"
          className="h-14 rounded-2xl text-base"
          disabled={busy}
          onClick={() => galleryInputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
          Elegir de la galería
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="h-14 rounded-2xl text-base"
          disabled={busy}
          onClick={() => cameraInputRef.current?.click()}
        >
          Tomar foto
        </Button>
      </div>

      {items.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-col gap-1 rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-foreground">{it.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {it.phase === "pending" && "Pendiente"}
                  {it.phase === "preparing" && "Optimizando…"}
                  {it.phase === "uploading" && "Subiendo…"}
                  {it.phase === "done" && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Lista
                    </span>
                  )}
                  {it.phase === "error" && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <XCircle className="size-3.5" aria-hidden /> Error
                    </span>
                  )}
                </span>
              </div>
              {it.phase === "error" && it.error ? (
                <p className="text-[11px] text-destructive">{it.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {globalError ? (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {globalError}
        </div>
      ) : null}

      {items.some((i) => i.phase === "error") ? (
        <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs text-muted-foreground">
          <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Pulsa <strong className="text-foreground">Elegir de la galería</strong> y selecciona de nuevo solo las fotos
            que marcaron error (cada una se sube por separado).
          </span>
        </p>
      ) : null}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Las fotos se envían de una en una para mayor fiabilidad en redes móviles. Este enlace es personal.
      </p>
    </div>
  );
}
