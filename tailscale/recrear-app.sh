#!/usr/bin/env bash
# Ejecutar en el servidor, en la raíz del repo (donde está docker-compose.yml), tras editar .env.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d --force-recreate app
docker compose ps app
