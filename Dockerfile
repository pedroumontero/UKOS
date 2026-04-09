FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* .npmrc ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Cliente alineado con schema (el volumen compose puede sustituir node_modules; el command debe hacer install+generate).
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Produccion: artefacto compilado + next start (sin Turbopack/HMR; evita "Compiling..." y pantallas en blanco tras login).
FROM base AS prod_builder
ARG NEXT_PUBLIC_UKOS_BUILD=
ARG NEXT_PUBLIC_UKOS_SHOW_BUILD_STAMP=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_UKOS_SHOW_BUILD_STAMP=$NEXT_PUBLIC_UKOS_SHOW_BUILD_STAMP
# Inyecta NEXT_PUBLIC_UKOS_BUILD en el bundle (siempre). Mostrar en UI solo si NEXT_PUBLIC_UKOS_SHOW_BUILD_STAMP=true al construir.
RUN BUILD_STAMP="${NEXT_PUBLIC_UKOS_BUILD:-$(date -u +%Y%m%d-%H%M%SZ)}" \
  && echo "NEXT_PUBLIC_UKOS_BUILD=$BUILD_STAMP" \
  && export NEXT_PUBLIC_UKOS_BUILD="$BUILD_STAMP" \
  && npx prisma generate \
  && npm run build

FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=prod_builder /app/node_modules ./node_modules
COPY --from=prod_builder /app/.next ./.next
COPY --from=prod_builder /app/public ./public
COPY --from=prod_builder /app/package.json ./package.json
COPY --from=prod_builder /app/package-lock.json ./package-lock.json
COPY --from=prod_builder /app/next.config.ts ./next.config.ts
COPY --from=prod_builder /app/lib-upload-limits.ts ./lib-upload-limits.ts
COPY --from=prod_builder /app/prisma ./prisma
COPY --from=prod_builder /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
