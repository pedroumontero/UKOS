#!/usr/bin/env bash
# Deploy completo: build sin cache, recrea ukos-app, valida produccion (audit + smoke).
# Ejecutar en el servidor, raiz del repo (donde esta docker-compose.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
if git -C "$ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
  STAMP="${STAMP}-$(git -C "$ROOT" rev-parse --short HEAD)"
fi
export UKOS_UI_BUILD="$STAMP"

echo "==> UKOS_UI_BUILD=$UKOS_UI_BUILD"
echo "==> docker compose build --no-cache app"
docker compose build --no-cache app

echo "==> docker compose up -d --force-recreate app"
docker compose up -d --force-recreate app

echo "==> Esperando app en 127.0.0.1:3000 ..."
ok=0
for i in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:3000/api/auth/csrf" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done
if [ "$ok" != 1 ]; then
  echo "ERROR: timeout esperando Next en :3000"
  docker compose logs --tail 80 app
  exit 1
fi

echo "==> Chunk marker en imagen (ukos-sidebar-module-v3)"
if docker exec ukos-app sh -c "grep -rl 'ukos-sidebar-module-v3' /app/.next/static/chunks 2>/dev/null | head -1" | grep -q .; then
  docker exec ukos-app sh -c "grep -rl 'ukos-sidebar-module-v3' /app/.next/static/chunks 2>/dev/null | head -1"
else
  echo "ERROR: no se encontro marker v3 en chunks del contenedor"
  exit 1
fi

echo "==> Sin texto legacy Contraer menu en chunks"
if docker exec ukos-app sh -c "grep -r 'Contraer menu' /app/.next/static/chunks 2>/dev/null | head -1" | grep -q .; then
  echo "ERROR: aun aparece Contraer menu en bundle"
  exit 1
fi
echo "    (ok)"

BASE_URL="${UKOS_PUBLIC_BASE_URL:-}"
if [ -z "$BASE_URL" ] && [ -f .env ]; then
  BASE_URL=$(grep -E '^UKOS_PUBLIC_BASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi
if [ -z "$BASE_URL" ]; then
  BASE_URL="https://ukos.tech"
fi

export UKOS_BASE_URL="$BASE_URL"
echo "==> audit:protected-bundle contra $UKOS_BASE_URL"
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run audit:protected-bundle

echo "==> Smoke HTTP (sin sesion; esperado 200/307/302 segun ruta)"
for path in /login /dashboard /market-flow/dashboard /system/users; do
  code=$(curl -sk -o /dev/null -w "%{http_code}" "${UKOS_BASE_URL}${path}" || echo "000")
  echo "    GET ${path} -> ${code}"
done

echo "==> Deploy completado. Build activo: $UKOS_UI_BUILD"
