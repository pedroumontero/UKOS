<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Política de entornos y despliegue

Documento operativo permanente. El agente de asistencia al código debe cumplirlo sin excepción.

## Separación obligatoria entre DEV y PROD

- DEV y PROD son entornos separados.
- DEV existe para desarrollo, pruebas, validación y troubleshooting.
- PROD existe solo para releases autorizados.

## Entorno DEV

| Concepto | Valor |
|----------|--------|
| URL pública | `dev-ukos.tech` |
| Contenedor | `ukos-app-dev` |
| Compose | `docker-compose.dev-remote.yml` |
| Puerto en host | `3001` |

**Salida HTTPS / OpenAI:** el servicio `app-dev` usa `dns: [1.1.1.1, 8.8.8.8]` y `NODE_OPTIONS=--dns-result-order=ipv4first`. Sin eso, en algunos hosts (p. ej. Tailscale + resolv del host) el contenedor puede devolver `EAI_AGAIN` al resolver `api.openai.com` y la IA de inventario muestra error de conexión. Tras cambiar el compose, recrear el contenedor (`docker compose ... up -d --force-recreate app-dev`).

**Caddy + dev lento:** el `Caddyfile` en `tailscale/caddy/` fija para `dev-ukos.tech` timeouts largos (`read_timeout` / `write_timeout` 3m) hacia `127.0.0.1:3001`, porque la primera compilación de `next dev --webpack` puede tardar decenas de segundos y un proxy corto devuelve 502/504. Tras editar el Caddyfile en la VM, recargar Caddy (`caddy reload` o el script de despliegue que copia el archivo). El arranque de `app-dev` ejecuta `scripts/warm-next-dev.mjs` en segundo plano para precalentar rutas de Market Flow.

## Entorno PROD

| Concepto | Valor |
|----------|--------|
| URL pública | `ukos.tech` |
| Contenedor | `ukos-app` |
| Compose | `docker-compose.yml` |
| Puerto en host | `3000` |

## Regla obligatoria para el agente

Si una tarea ocurre en DEV o se enmarca en desarrollo o troubleshooting:

- El agente **solo** puede trabajar sobre **DEV** (código, contenedor `ukos-app-dev`, compose de desarrollo, puerto `3001`, URL `dev-ukos.tech`).
- El agente **no** puede tocar **PROD**.
- El agente **no** puede reconstruir la imagen o contenedor **`ukos-app`** por iniciativa propia.
- El agente **no** puede ejecutar `npm run deploy:prod` ni `bash scripts/deploy-ukos-prod.sh` sin orden explícita.
- El agente **no** puede recrear el contenedor de producción por iniciativa propia.
- El agente **no** puede promover cambios de DEV a PROD por decisión propia.

## Autorización de producción

La producción solo se modifica o despliega si **Pedro** lo ordena **explícitamente**.

Ejemplos de autorización explícita (lista no exhaustiva):

- «Haz deploy a prod.»
- «Despliega a producción.»
- «Publica esto en producción.»

Sin una instrucción explícita de Pedro, cualquier arreglo o cambio validado en DEV debe **permanecer solo en DEV**.

## Flujo correcto

1. Cambios y pruebas en la rama de trabajo acordada (p. ej. `develop`).
2. Validación en **DEV** (`dev-ukos.tech`).
3. Promoción a `main` (o rama de release) **cuando Pedro lo decida**.
4. Deploy a **PROD** ejecutado **únicamente** con autorización explícita de Pedro.

## Regla de seguridad operativa

Si el agente considera que un cambio probado en DEV debería pasar a PROD:

- Debe **informarlo** con claridad.
- Puede **recomendarlo** si es razonable.
- **No** debe desplegarlo ni actuar sobre PROD por cuenta propia.

---

## Referencia técnica (solo tras autorización explícita de Pedro)

Cuando Pedro haya ordenado explícitamente un deploy a producción, la secuencia esperada en este repositorio incluye `npm run deploy:prod` (envuelve `scripts/deploy-ukos-prod.sh`: build sin caché del servicio `app`, recreación de `ukos-app`, comprobaciones y `audit:protected-bundle` contra `UKOS_PUBLIC_BASE_URL` del `.env`). Hasta recibir esa orden, el agente no ejecuta estos pasos.

**Marcador de build en UI (opcional):** con `UKOS_SHOW_BUILD_STAMP=true` en el entorno de build (arg de compose) el sidebar puede mostrar una línea `Build …`. Por defecto debe ir en `false` para usuarios finales. El identificador puede incrustarse en el cliente como `NEXT_PUBLIC_UKOS_BUILD`.
