# CSCX — Escola Instructiva
#
# Build determinístico, sem cache mounts do BuildKit — é justamente o cache
# mount do Nixpacks que estava falhando no builder do Railway
# ("runc run failed ... error mounting").
#
# Uso local:
#   docker build -t cscx .
#   docker run -p 3000:3000 -e DATABASE_URL=... -e AUTH_SECRET=... cscx

FROM node:22-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ─────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# node_modules completo: o start aplica o schema com drizzle-kit antes de subir
COPY --from=deps  /app/node_modules   ./node_modules
COPY --from=build /app/.next          ./.next
COPY --from=build /app/public         ./public
COPY --from=build /app/package.json   ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/tsconfig.json  ./tsconfig.json
COPY --from=build /app/scripts        ./scripts
COPY --from=build /app/src            ./src

EXPOSE 3000
CMD ["npm", "run", "start"]
