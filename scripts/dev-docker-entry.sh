#!/usr/bin/env sh
set -eu
# Solo instalar dependencias si el volumen node_modules no tiene el CLI de Next (evita npm install en cada restart → picos de RAM/CPU).
if [ ! -x /app/node_modules/.bin/next ]; then
  npm install --no-audit --no-fund
fi
npx prisma generate
npx prisma migrate deploy
# El warm en background compite con la primera compilación de next dev y puede disparar OOM en VMs 8G.
# Activar explícitamente con UKOS_DEV_WARM=1 si hace falta.
if [ "${UKOS_DEV_WARM:-0}" = "1" ]; then
  # Dejar que la primera compilación de /login arranque sin competencia (evita colas de 1–2 min en webpack).
  (sleep 25 && exec node scripts/warm-next-dev.mjs) &
fi
exec npm run dev:docker
