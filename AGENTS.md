<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy obligatorio (UKOS en produccion)

En el servidor donde corre **ukos.com** (Docker + Caddy → `127.0.0.1:3000`), **cada tarea que cambie codigo** debe terminar con deploy real:

1. Desde la raiz del repo: `npm run deploy:prod` (o `bash scripts/deploy-ukos-prod.sh`).
2. Eso ejecuta `docker compose build --no-cache app`, `up -d --force-recreate app`, comprobaciones en el contenedor y `npm run audit:protected-bundle` contra `UKOS_PUBLIC_BASE_URL` del `.env`.
3. **No cerrar** un cambio de producto sin que el audit pase y ukos.com sirva el bundle nuevo.

**Marcador de build en UI (opcional):** con `UKOS_SHOW_BUILD_STAMP=true` en el entorno de **build** (arg de compose) el sidebar muestra una linea `Build …`. Por defecto va en `false` para usuarios finales. El identificador siempre queda incrustado en el cliente como `NEXT_PUBLIC_UKOS_BUILD`.
