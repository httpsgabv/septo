# Build context: monorepo root (docker compose sets it).
FROM node:24-alpine AS base
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx --yes turbo@2.10.13 prune @septo/web --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
# The client is generated from the committed contract; building the api here is unnecessary.
COPY apps/api/openapi.json apps/api/openapi.json
RUN npm run codegen -w @septo/web && npx turbo run build --filter=@septo/web --only

# Nitro's .output is self-contained (server bundle + traced node_modules).
FROM base AS runner
# Same port as `npm run dev`, so Caddy upstreams look alike in dev and production.
ENV NODE_ENV=production PORT=5173
COPY --from=builder /app/apps/web/.output ./.output
USER node
EXPOSE 5173
CMD ["node", ".output/server/index.mjs"]
