import { ModuleKey } from "@prisma/client";

/** Claves internas estables; la UI usa label + descripcion del catalogo. */
export const ACCESS_CATALOG = [
  {
    key: "general.dashboard.view",
    label: "Ver Dashboard General",
    description: "Acceso a la pantalla principal de resumen.",
    group: "General",
  },
  {
    key: "market_flow.section.view",
    label: "Ver Market Flow",
    description: "Mostrar la seccion Market Flow en el menu.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.dashboard.view",
    label: "Ver Dashboard de Market Flow",
    description: "Métricas y estado del modulo comercial.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.inventory.view",
    label: "Ver Inventario",
    description: "Listar y abrir unidades de inventario.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.inventory.create",
    label: "Crear inventario",
    description: "Registrar nuevas unidades o borradores.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.inventory.edit",
    label: "Editar inventario",
    description: "Modificar datos de unidades existentes.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.inventory.delete",
    label: "Eliminar inventario",
    description: "Eliminar o dar de baja unidades (cuando aplique).",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.publish.view",
    label: "Ver Publicar",
    description: "Acceso a la vista de publicaciones y canales.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.publish.manage",
    label: "Gestionar publicaciones",
    description: "Publicar, actualizar o retirar ofertas.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.leads.view",
    label: "Ver Leads",
    description: "Ver listado y detalle de leads.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.leads.manage",
    label: "Gestionar Leads",
    description: "Actualizar estado, notas y conversaciones.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.settings.view",
    label: "Ver configuraciones de Market Flow",
    description: "Abrir ajustes del modulo (solo lectura donde aplique).",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "market_flow.settings.edit",
    label: "Editar configuraciones de Market Flow",
    description: "Cambiar tono IA, industria y preferencias del modulo.",
    group: "Market Flow",
    requiresModule: ModuleKey.MARKET_FLOW,
  },
  {
    key: "tenant.system.nav.view",
    label: "Entrar a Configuracion del sistema",
    description: "Ver el grupo y las pantallas de administracion del tenant.",
    group: "Sistema de la empresa",
  },
  {
    key: "tenant.users.view",
    label: "Ver usuarios",
    description: "Listar miembros de la empresa.",
    group: "Sistema de la empresa",
  },
  {
    key: "tenant.users.create",
    label: "Crear usuarios",
    description: "Dar de alta nuevos usuarios en la empresa.",
    group: "Sistema de la empresa",
  },
  {
    key: "tenant.users.edit",
    label: "Editar usuarios",
    description: "Cambiar rol u overrides de acceso.",
    group: "Sistema de la empresa",
  },
  {
    key: "tenant.roles.view",
    label: "Ver roles",
    description: "Listar roles definidos en la empresa.",
    group: "Sistema de la empresa",
  },
  {
    key: "tenant.roles.create",
    label: "Crear roles",
    description: "Definir nuevos perfiles de acceso.",
    group: "Sistema de la empresa",
  },
  {
    key: "tenant.roles.edit",
    label: "Editar roles",
    description: "Modificar nombre y accesos de un rol.",
    group: "Sistema de la empresa",
  },
  {
    key: "tenant.access.catalog_view",
    label: "Gestionar accesos",
    description: "Ver el catalogo de accesos y como se aplican a los roles.",
    group: "Sistema de la empresa",
  },
] as const;

export type AccessKey = (typeof ACCESS_CATALOG)[number]["key"];

export type AccessCatalogEntry = (typeof ACCESS_CATALOG)[number];

export const ALL_ACCESS_KEYS: AccessKey[] = ACCESS_CATALOG.map((e) => e.key);

const KEY_SET = new Set<string>(ALL_ACCESS_KEYS);

export function isAccessKey(value: string): value is AccessKey {
  return KEY_SET.has(value);
}

export function getAccessEntry(key: string): AccessCatalogEntry | undefined {
  return ACCESS_CATALOG.find((e) => e.key === key);
}

/** Accesos de Market Flow para rol operador por defecto (sin CRUD agresivo ni settings). */
export const DEFAULT_OPERATOR_MARKET_FLOW_KEYS: AccessKey[] = [
  "market_flow.section.view",
  "market_flow.dashboard.view",
  "market_flow.inventory.view",
  "market_flow.publish.view",
  "market_flow.leads.view",
];

/** Claves que recibe el administrador de empresa por defecto (todo el catalogo). */
export const DEFAULT_TENANT_ADMIN_ACCESS_KEYS: AccessKey[] = [...ALL_ACCESS_KEYS];
