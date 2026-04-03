"use client";

import * as React from "react";
import { CircleDot, MessageSquarePlus, Plus, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { addLeadMessageAction, createLeadAction, updateLeadResolutionAction } from "@/features/market-flow/leads/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type LeadRecord = {
  id: string;
  displayName: string;
  contactValue: string | null;
  createdAt: Date;
  hasActiveConversation: boolean;
  resolution: string;
  channel: { id: string; displayName: string } | null;
  unit: { id: string; number: string; title: string } | null;
  conversations: Array<{
    id: string;
    status: string;
    messages: Array<{
      id: string;
      content: string;
      direction: string;
      authorType: string;
      sentAt: Date;
    }>;
  }>;
};

type LeadFormContext = {
  units: Array<{ id: string; number: string; title: string }>;
  channels: Array<{ id: string; displayName: string }>;
};

type LeadsPageProps = {
  leads: LeadRecord[];
  formContext: LeadFormContext;
};

function formatUtcDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatUtcTime(value: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

const resolutionOptions = [
  { value: "OPEN", label: "Abierto" },
  { value: "IN_CONVERSATION", label: "En conversación" },
  { value: "INTERESTED", label: "Interesado" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "LOST", label: "Perdido" },
] as const;

export function LeadsPage({ leads, formContext }: LeadsPageProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(media.matches);

    onChange();
    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Leads</CardTitle>
            <CardDescription>Persona, producto y mensajes en un solo lugar. Ligero, sin CRM pesado.</CardDescription>
          </div>
          <NewLeadOverlay formContext={formContext} trigger={<Button className="h-11 rounded-2xl"><Plus className="size-4" />Nuevo Lead</Button>} />
        </CardHeader>
        <CardContent>
          {isMobile ? <LeadMobileList leads={leads} /> : <LeadDesktopTable leads={leads} />}
        </CardContent>
      </Card>
    </div>
  );
}

function LeadDesktopTable({ leads }: { leads: LeadRecord[] }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/90">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre o contacto</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Conversación</TableHead>
            <TableHead>Resolución</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <LeadConversationOverlay
                  lead={lead}
                  trigger={
                    <button type="button" className="w-full text-left">
                      <p className="font-semibold text-foreground">{lead.displayName}</p>
                      <p className="text-sm text-muted-foreground">{lead.contactValue || "Sin contacto adicional"}</p>
                    </button>
                  }
                />
              </TableCell>
              <TableCell>{lead.unit ? `${lead.unit.number} · ${lead.unit.title}` : "Sin producto"}</TableCell>
              <TableCell>{lead.channel?.displayName || "Directo"}</TableCell>
              <TableCell>{formatUtcDate(lead.createdAt)}</TableCell>
              <TableCell>
                <Badge variant={lead.hasActiveConversation ? "default" : "secondary"} className={lead.hasActiveConversation ? "" : "text-muted-foreground"}>
                  {lead.hasActiveConversation ? "Activa" : "Sin actividad"}
                </Badge>
              </TableCell>
              <TableCell>{resolutionOptions.find((item) => item.value === lead.resolution)?.label || lead.resolution}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeadMobileList({ leads }: { leads: LeadRecord[] }) {
  return (
    <div className="space-y-3">
      {leads.map((lead) => (
        <LeadConversationOverlay
          key={lead.id}
          lead={lead}
          trigger={
            <button type="button" className="w-full rounded-[1.75rem] border border-border/60 bg-background/90 p-4 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{lead.displayName}</p>
                  <p className="text-sm text-muted-foreground">{lead.unit ? `${lead.unit.number} · ${lead.unit.title}` : "Sin producto"}</p>
                </div>
                <Badge variant={lead.hasActiveConversation ? "default" : "secondary"} className={lead.hasActiveConversation ? "" : "text-muted-foreground"}>
                  {lead.hasActiveConversation ? "Activa" : "Sin actividad"}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>{lead.channel?.displayName || "Directo"}</span>
                <span>{resolutionOptions.find((item) => item.value === lead.resolution)?.label || lead.resolution}</span>
              </div>
            </button>
          }
        />
      ))}
    </div>
  );
}

function mergeTriggerOpen(
  trigger: React.ReactNode,
  open: () => void,
): React.ReactNode {
  if (!React.isValidElement(trigger)) {
    return (
      <button type="button" className="text-left" onClick={open}>
        {trigger}
      </button>
    );
  }
  const previous = (trigger.props as { onClick?: React.MouseEventHandler }).onClick;
  return React.cloneElement(trigger as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
    onClick: (event: React.MouseEvent) => {
      previous?.(event);
      if (!event.defaultPrevented) {
        open();
      }
    },
  });
}

function LeadConversationOverlay({ lead, trigger }: { lead: LeadRecord; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const content = <LeadConversationContent lead={lead} onDone={() => setOpen(false)} />;

  return (
    <>
      {mergeTriggerOpen(trigger, () => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[94vh] w-[min(1060px,calc(100vw-1rem))] max-w-none flex-col rounded-[1.75rem] border-border/60 bg-background p-0 sm:h-[92vh] sm:w-[min(1040px,calc(100vw-2rem))] sm:rounded-[2rem]">
          <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-8 sm:py-6">
            <DialogTitle>{lead.displayName}</DialogTitle>
            <DialogDescription>{lead.unit ? `${lead.unit.number} · ${lead.unit.title}` : "Sin producto relacionado"}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">{content}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LeadConversationContent({ lead, onDone }: { lead: LeadRecord; onDone: () => void }) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");
  const [resolution, setResolution] = React.useState(lead.resolution);
  const conversation = lead.conversations[0];

  const sendMessage = (direction: "INBOUND" | "OUTBOUND") => {
    if (!conversation || !message.trim()) return;
    const formData = new FormData();
    formData.set("conversationId", conversation.id);
    formData.set("content", message.trim());
    formData.set("direction", direction);

    startTransition(async () => {
      const result = await addLeadMessageAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No fue posible guardar el mensaje.");
        return;
      }

      toast.success("Mensaje guardado.");
      setMessage("");
      onDone();
    });
  };

  const saveResolution = () => {
    const formData = new FormData();
    formData.set("leadId", lead.id);
    formData.set("resolution", resolution);

    startTransition(async () => {
      const result = await updateLeadResolutionAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No fue posible actualizar la resolucion.");
        return;
      }

      toast.success("Resolucion actualizada.");
      onDone();
    });
  };

  const sortedMessages = React.useMemo(() => {
    const list = conversation?.messages ?? [];
    return [...list].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [conversation?.messages]);

  return (
    <div className="space-y-6 pb-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr] 2xl:grid-cols-[minmax(0,300px)_1fr]">
        <Card className="h-fit rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Contexto</CardTitle>
            <CardDescription>Datos del lead y seguimiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Contacto: </span>
              {lead.contactValue || "No capturado"}
            </p>
            <p>
              <span className="font-medium text-foreground">Canal: </span>
              {lead.channel?.displayName || "Directo"}
            </p>
            <p>
              <span className="font-medium text-foreground">Producto: </span>
              {lead.unit ? `${lead.unit.number} · ${lead.unit.title}` : "Sin producto"}
            </p>
            <p>
              <span className="font-medium text-foreground">Actividad: </span>
              {lead.hasActiveConversation ? "Conversación activa" : "Sin conversación activa"}
            </p>
            <div className="space-y-2 pt-2">
              <Label>Resolución</Label>
              <Select value={resolution} onValueChange={(value) => setResolution(value ?? "OPEN")}>
                <SelectTrigger className="h-11 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" className="w-full rounded-2xl" disabled={pending} onClick={saveResolution}>
                Guardar resolución
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[min(520px,65vh)] flex-col overflow-hidden rounded-[1.75rem] border-border/60 bg-card/90 shadow-sm">
          <CardHeader className="shrink-0 border-b border-border/50 pb-4">
            <CardTitle className="text-lg">Conversación</CardTitle>
            <CardDescription>
              {conversation ? "Mensajes en orden cronológico." : "Aún no hay conversación vinculada."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-3 py-4 sm:px-5">
              <div className="mx-auto flex max-w-2xl flex-col gap-3">
                {!conversation ? (
                  <p className="rounded-2xl border border-dashed border-border/70 bg-background/80 px-4 py-6 text-center text-sm text-muted-foreground">
                    No hay hilo de mensajes para este lead.
                  </p>
                ) : sortedMessages.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border/70 bg-background/80 px-4 py-6 text-center text-sm text-muted-foreground">
                    Aún no hay mensajes. Escribe el primero abajo.
                  </p>
                ) : (
                  sortedMessages.map((item) => {
                    const outbound = item.direction === "OUTBOUND";
                    const author =
                      item.authorType === "HUMAN" ? "Tú" : item.authorType === "LEAD" ? "Cliente" : item.authorType;
                    return (
                      <div key={item.id} className={cn("flex w-full", outbound ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[min(100%,28rem)] rounded-2xl px-4 py-3 text-sm shadow-sm",
                            outbound
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border border-border/60 bg-background text-foreground",
                          )}
                        >
                          <div
                            className={cn(
                              "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-tight",
                              outbound ? "text-primary-foreground/85" : "text-muted-foreground",
                            )}
                          >
                            <span className="inline-flex items-center gap-1 font-medium">
                              <CircleDot className="size-3 shrink-0 opacity-80" />
                              {author}
                            </span>
                            <span className="opacity-50">·</span>
                            <time dateTime={new Date(item.sentAt).toISOString()}>
                              {formatUtcDate(item.sentAt)} · {formatUtcTime(item.sentAt)}
                            </time>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="shrink-0 space-y-3 border-t border-border/60 bg-background/95 p-4 sm:p-5">
              <div className="space-y-2">
                <Label htmlFor={`message-${lead.id}`}>Escribir mensaje</Label>
                <Textarea
                  id={`message-${lead.id}`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-24 rounded-2xl"
                  placeholder="Texto del mensaje…"
                  disabled={!conversation}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={pending || !conversation}
                  onClick={() => sendMessage("INBOUND")}
                >
                  <MessageSquarePlus className="size-4" />
                  Registrar mensaje del cliente
                </Button>
                <Button type="button" className="rounded-2xl" disabled={pending || !conversation} onClick={() => sendMessage("OUTBOUND")}>
                  <SendHorizontal className="size-4" />
                  Enviar tu respuesta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NewLeadOverlay({ formContext, trigger }: { formContext: LeadFormContext; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const content = <NewLeadForm formContext={formContext} onDone={() => setOpen(false)} />;

  return (
    <>
      {mergeTriggerOpen(trigger, () => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex w-[min(760px,calc(100vw-1rem))] max-w-none flex-col rounded-[1.75rem] border-border/60 bg-background p-0 sm:w-[min(760px,calc(100vw-2rem))] sm:rounded-[2rem]">
          <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-8 sm:py-6">
            <DialogTitle>Nuevo Lead</DialogTitle>
            <DialogDescription>Registra un contacto y, si quieres, el primer mensaje.</DialogDescription>
          </DialogHeader>
          <div className="px-4 py-4 sm:px-8 sm:py-6">{content}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewLeadForm({ formContext, onDone }: { formContext: LeadFormContext; onDone: () => void }) {
  const [pending, startTransition] = React.useTransition();
  const [displayName, setDisplayName] = React.useState("");
  const [contactValue, setContactValue] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [channelId, setChannelId] = React.useState("");
  const [initialMessage, setInitialMessage] = React.useState("");

  const submit = () => {
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("contactValue", contactValue);
    if (unitId) formData.set("unitId", unitId);
    if (channelId) formData.set("channelId", channelId);
    if (initialMessage) formData.set("initialMessage", initialMessage);

    startTransition(async () => {
      const result = await createLeadAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No fue posible crear el lead.");
        return;
      }

      toast.success("Lead creado correctamente.");
      onDone();
    });
  };

  return (
    <div className="space-y-4 pb-2">
      <div className="space-y-2">
        <Label>Nombre o cómo lo conoces</Label>
        <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-11 rounded-2xl" />
      </div>
      <div className="space-y-2">
        <Label>Teléfono, correo o usuario</Label>
        <Input value={contactValue} onChange={(event) => setContactValue(event.target.value)} className="h-11 rounded-2xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Producto (opcional)</Label>
          <Select value={unitId} onValueChange={(value) => setUnitId(value ?? "")}>
            <SelectTrigger className="h-11 rounded-2xl">
              <SelectValue placeholder="Sin producto" />
            </SelectTrigger>
            <SelectContent>
              {formContext.units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>{unit.number} · {unit.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Canal (opcional)</Label>
          <Select value={channelId} onValueChange={(value) => setChannelId(value ?? "")}>
            <SelectTrigger className="h-11 rounded-2xl">
              <SelectValue placeholder="Directo / sin canal" />
            </SelectTrigger>
            <SelectContent>
              {formContext.channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>{channel.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Primer mensaje (opcional)</Label>
        <Textarea value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} className="min-h-28 rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Button type="button" className="rounded-2xl" disabled={pending} onClick={submit}>Crear Lead</Button>
      </div>
    </div>
  );
}
