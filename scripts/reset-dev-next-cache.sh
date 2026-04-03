#!/usr/bin/env bash
# Evita caché Turbopack rota (p. ej. "useSearchParams is not defined" con fuente correcta):
# hay que borrar .next con el contenedor dev parado.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if docker ps -q -f name=ukos-app-dev | grep -q .; then
  docker stop ukos-app-dev
fi
rm -rf .next 2>/dev/null || sudo rm -rf .next
docker start ukos-app-dev
echo "==> ukos-app-dev reiniciado; .next limpio."
