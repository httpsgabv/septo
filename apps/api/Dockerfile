# Build context: monorepo root (docker compose sets it).
FROM node:24-alpine AS base
WORKDIR /app

# Only the api and the workspaces it depends on.
FROM base AS pruner
COPY . .
RUN npx --yes turbo@2.10.13 prune @septo/api --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=@septo/api && npm prune --omit=dev

# `prisma` is a runtime dependency: the container applies migrations on start.
# ponytail: the prisma CLI is ~250MB of the ~800MB image; move migrations to a one-off job
# (builder stage) if image size or pull time starts to matter.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app .
WORKDIR /app/apps/api
USER node
EXPOSE 3333
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
