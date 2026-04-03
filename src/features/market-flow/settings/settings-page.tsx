"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createChannelAction,
  deleteChannelAction,
  toggleChannelAction,
  updateCompanyNameAction,
  updateIntegrationsSettingsAction,
  updateMarketFlowSettingsAction,
} from "@/features/market-flow/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const INDUSTRY_OPTIONS = [
  "Tecnologia / Hardware",
  "Movilidad / Vehiculos",
  "Hogar / Electrodomesticos",
  "Moda / Accesorios",
  "Servicios Profesionales",
  "Otro",
] as const;

const PRICE_STRATEGY_OPTIONS = [
  { value: "manual", label: "Manual (operador define precios)" },
  { value: "competitive", label: "Competitivo (ajustar al mercado)" },
  { value: "premium", label: "Premium (margen alto)" },
] as const;

type IntegrationsJson = {
  openaiApiKey?: string;
  openaiModel?: string;
};

function readIntegrations(settingsJson: unknown): IntegrationsJson {
  if (!settingsJson || typeof settingsJson !== "object") {
    return {};
  }

  const raw = settingsJson as { integrations?: unknown };
  if (!raw.integrations || typeof raw.integrations !== "object") {
    return {};
  }

  const integ = raw.integrations as Record<string, unknown>;
  return {
    openaiApiKey: typeof integ.openaiApiKey === "string" ? integ.openaiApiKey : "",
    openaiModel: typeof integ.openaiModel === "string" ? integ.openaiModel : "",
  };
}

export type SettingsPageProps = {
  company: { id: string; name: string };
  marketFlowSettings: {
    industryType: string;
    aiToneProfile: string;
    defaultPriceStrategy: string;
    settingsJson: unknown;
  } | null;
  channels: Array<{
    id: string;
    displayName: string;
    code: string;
    isEnabled: boolean;
    sortOrder: number;
  }>;
};

export function MarketFlowSettingsPageClient({
  company,
  marketFlowSettings,
  channels: initialChannels,
}: SettingsPageProps) {
  const [pending, startTransition] = React.useTransition();
  const [channels, setChannels] = React.useState(initialChannels);

  React.useEffect(() => {
    setChannels(initialChannels);
  }, [initialChannels]);

  const [companyName, setCompanyName] = React.useState(company.name);
  const [industryType, setIndustryType] = React.useState(
    marketFlowSettings?.industryType ?? "Tecnologia / Hardware",
  );
  const [aiToneProfile, setAiToneProfile] = React.useState(
    marketFlowSettings?.aiToneProfile ?? "Vendedor amable y profesional",
  );
  const [defaultPriceStrategy, setDefaultPriceStrategy] = React.useState(
    marketFlowSettings?.defaultPriceStrategy ?? "manual",
  );

  const integrations = readIntegrations(marketFlowSettings?.settingsJson);
  const [openaiApiKey, setOpenaiApiKey] = React.useState(integrations.openaiApiKey ?? "");
  const [openaiModel, setOpenaiModel] = React.useState(integrations.openaiModel ?? "");

  React.useEffect(() => {
    const next = readIntegrations(marketFlowSettings?.settingsJson);
    setOpenaiApiKey(next.openaiApiKey ?? "");
    setOpenaiModel(next.openaiModel ?? "");
  }, [marketFlowSettings?.settingsJson]);

  const [newChannelName, setNewChannelName] = React.useState("");
  const [newChannelCode, setNewChannelCode] = React.useState("");

  const saveCompany = () => {
    const formData = new FormData();
    formData.set("name", companyName);
    startTransition(async () => {
      const result = await updateCompanyNameAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No se pudo guardar.");
        return;
      }
      toast.success("Nombre de empresa actualizado.");
    });
  };

  const saveModule = () => {
    const formData = new FormData();
    formData.set("industryType", industryType);
    formData.set("aiToneProfile", aiToneProfile);
    formData.set("defaultPriceStrategy", defaultPriceStrategy);
    startTransition(async () => {
      const result = await updateMarketFlowSettingsAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No se pudo guardar.");
        return;
      }
      toast.success("Configuración de Market Flow guardada.");
    });
  };

  const saveIntegrations = () => {
    const formData = new FormData();
    formData.set("openaiApiKey", openaiApiKey);
    formData.set("openaiModel", openaiModel);
    startTransition(async () => {
      const result = await updateIntegrationsSettingsAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No se pudo guardar.");
        return;
      }
      toast.success("Integraciones guardadas. La IA aún no está activa en la app.");
    });
  };

  const toggleChannel = (channelId: string, isEnabled: boolean) => {
    const formData = new FormData();
    formData.set("channelId", channelId);
    formData.set("isEnabled", String(isEnabled));
    startTransition(async () => {
      const result = await toggleChannelAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No se pudo actualizar el canal.");
        return;
      }
      setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, isEnabled } : c)));
      toast.success(isEnabled ? "Canal activado." : "Canal desactivado.");
    });
  };

  const addChannel = () => {
    const formData = new FormData();
    formData.set("displayName", newChannelName);
    if (newChannelCode.trim()) {
      formData.set("code", newChannelCode);
    }
    startTransition(async () => {
      const result = await createChannelAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No se pudo crear el canal.");
        return;
      }
      setNewChannelName("");
      setNewChannelCode("");
      toast.success("Canal creado y vinculado al inventario existente.");
      window.location.reload();
    });
  };

  const removeChannel = (channelId: string, label: string) => {
    if (!window.confirm(`Eliminar el canal "${label}"? Se borraran sus publicaciones asociadas.`)) {
      return;
    }
    const formData = new FormData();
    formData.set("channelId", channelId);
    startTransition(async () => {
      const result = await deleteChannelAction(formData);
      if (!result.ok) {
        toast.error(result.error || "No se pudo eliminar.");
        return;
      }
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      toast.success("Canal eliminado.");
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Empresa activa en esta sesion y nombre visible en el sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Empresa activa: </span>
            <span className="font-medium text-foreground">{company.name}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-name">Nombre de la empresa</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="h-11 rounded-2xl"
            />
          </div>
          <Button type="button" className="rounded-2xl" disabled={pending} onClick={saveCompany}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar nombre
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Rubro</CardTitle>
          <CardDescription>Contexto del negocio guardado en la base de datos por empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Rubro principal</Label>
            <Select value={industryType} onValueChange={(value) => setIndustryType(value ?? industryType)}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" className="rounded-2xl" disabled={pending} onClick={saveModule}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar rubro
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>IA (sin conexion aun)</CardTitle>
          <CardDescription>
            Tono y estrategia de precio por defecto. OpenAI no se ejecuta en la app hasta la siguiente fase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-tone">Tono para futuras sugerencias</Label>
            <Textarea
              id="ai-tone"
              value={aiToneProfile}
              onChange={(event) => setAiToneProfile(event.target.value)}
              className="min-h-24 rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Estrategia de precio por defecto</Label>
            <Select
              value={
                PRICE_STRATEGY_OPTIONS.some((option) => option.value === defaultPriceStrategy)
                  ? defaultPriceStrategy
                  : "manual"
              }
              onValueChange={(value) => setDefaultPriceStrategy(value ?? "manual")}
            >
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_STRATEGY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" className="rounded-2xl" disabled={pending} onClick={saveModule}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar preferencias de IA
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Canales</CardTitle>
          <CardDescription>Activa, crea o elimina canales de publicacion para esta empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {channels.length ? (
              channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{channel.displayName}</p>
                    <p className="text-xs text-muted-foreground">Codigo interno: {channel.code}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={channel.isEnabled ? "default" : "secondary"}>
                      {channel.isEnabled ? "Activo" : "Desactivado"}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={pending}
                      onClick={() => toggleChannel(channel.id, !channel.isEnabled)}
                    >
                      {channel.isEnabled ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => removeChannel(channel.id, channel.displayName)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hay canales configurados.</p>
            )}
          </div>
          <Separator />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-channel-name">Nombre visible del nuevo canal</Label>
              <Input
                id="new-channel-name"
                value={newChannelName}
                onChange={(event) => setNewChannelName(event.target.value)}
                placeholder="Ej. Mercado Libre"
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-channel-code">Codigo interno (opcional)</Label>
              <Input
                id="new-channel-code"
                value={newChannelCode}
                onChange={(event) => setNewChannelCode(event.target.value)}
                placeholder="mercado_libre"
                className="h-11 rounded-2xl"
              />
            </div>
          </div>
          <Button type="button" className="rounded-2xl" disabled={pending || !newChannelName.trim()} onClick={addChannel}>
            <Plus className="size-4" />
            Agregar canal
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Integraciones</CardTitle>
          <CardDescription>
            Guarda credenciales de OpenAI para una fase posterior. No se usan en la app todavia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-key">Clave API de OpenAI</Label>
            <Input
              id="openai-key"
              type="password"
              autoComplete="off"
              value={openaiApiKey}
              onChange={(event) => setOpenaiApiKey(event.target.value)}
              placeholder="sk-..."
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-model">Modelo</Label>
            <Input
              id="openai-model"
              value={openaiModel}
              onChange={(event) => setOpenaiModel(event.target.value)}
              placeholder="gpt-4o-mini"
              className="h-11 rounded-2xl"
            />
          </div>
          <Button type="button" variant="secondary" className="rounded-2xl" disabled={pending} onClick={saveIntegrations}>
            Guardar integraciones
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
