# septo

Um lugar só para as ferramentas que hoje ficam espalhadas em vários apps: notas e lembretes, e ferramentas do dia a dia de dev (formatador JSON, gerador de chaves RSA, conversor de arquivos, leitor de README).

Projeto pessoal, usuário único, hospedado numa VPS.

## Stack

| | |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| API | NestJS 12 (ESM, SWC) · Prisma 7 + PostgreSQL 18 · zod → OpenAPI · docs no Scalar |
| Web | TanStack Start (SSR) · TanStack Query · client gerado pelo Orval (axios) |
| UI | `@septo/ui`: Tailwind v4 + shadcn (Base UI), tema claro/escuro e cor de destaque customizável |
| Qualidade | Biome · Vitest · Playwright |
| Infra | Docker Compose · Caddy (HTTPS automático) |

## Começando

Requisitos: Node ≥ 24, npm 11, Docker.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run dev
```

- App: http://localhost:5173 ou https://localhost (via Caddy)
- Docs da API (Scalar): http://localhost:5173/api/docs

`docker compose up -d` sobe só a infra: o Postgres (porta **5433**, apenas em `127.0.0.1`, para não brigar com um Postgres local) e o Caddy, que dá HTTPS em https://localhost na frente dos servidores de dev (útil para Web Push e cookies `Secure`). O navegador avisa sobre o certificado local do Caddy até você confiar nele.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | API (:3333) + web (:5173), gerando antes o contrato e o client |
| `npm run build` | Build de tudo, com cache do Turbo |
| `npm run check-types` | Type-check de todos os pacotes |
| `npm run test` | Testes unitários e de integração (a API usa o banco `septo_test`, precisa do Postgres no ar) |
| `npm run test:e2e` | Playwright; sobe os servidores de dev sozinho (precisa do Postgres no ar) |
| `docker compose up -d` | Infra: Postgres + Caddy (https://localhost) |
| `npm run lint` / `npm run format` | Biome: verificar / corrigir |
| `npm run codegen` | Gera `apps/api/openapi.json` e o client do web |
| `npm run db:migrate -w @septo/api` | Cria e aplica migrações do Prisma |

### Mudou a API?

O contrato nasce nos schemas zod dos controllers. Depois de mudar um endpoint:

```bash
npm run codegen
```

Isso atualiza o `apps/api/openapi.json` (que é commitado) e regenera os hooks do web. Um teste falha se o arquivo commitado estiver desatualizado.

## Produção

O compose continua só com Postgres e Caddy. API e web rodam como imagens avulsas na rede `septo` (criada pelo compose), sem publicar portas:

```bash
docker build -f apps/api/Dockerfile -t septo-api .
```

```bash
docker build -f apps/web/Dockerfile -t septo-web .
```

```bash
docker run -d --name septo-api --network septo --restart unless-stopped -e DATABASE_URL=postgresql://septo:<senha>@postgres:5432/septo septo-api
```

```bash
docker run -d --name septo-web --network septo --restart unless-stopped -e API_INTERNAL_URL=http://septo-api:3333 septo-web
```

No `.env` da VPS:

```dotenv
APP_DOMAIN=seu.dominio
API_UPSTREAM=septo-api:3333
WEB_UPSTREAM=septo-web:5173
POSTGRES_PASSWORD=<senha forte>
```

Depois `docker compose up -d`. O Caddy emite o certificado Let's Encrypt sozinho: aponte o DNS para a VPS e abra as portas 80 e 443. A API aplica as migrações do Prisma ao iniciar.

## Estrutura

```
apps/api            NestJS: um módulo por contexto (domain / application / infrastructure / presentation)
apps/web            TanStack Start: src/routes (finas) + src/features/<contexto>
packages/ui         design system
packages/typescript-config
specs/              uma spec por módulo
tasks/<módulo>/     plano e tarefas do módulo
```

## Documentação

- [CAPABILITY-MAP.md](CAPABILITY-MAP.md): módulos, ordem de construção e decisões globais
- [specs/](specs/): a spec de cada módulo. A do [foundation](specs/SPEC-foundation.md) define as convenções que valem para todo o projeto
- [CLAUDE.md](CLAUDE.md): contexto para agentes de IA
