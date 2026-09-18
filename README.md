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
docker compose up -d postgres
npm run dev
```

- App: http://localhost:5173
- Docs da API (Scalar): http://localhost:5173/api/docs

O Postgres do container fica na porta **5433** do host, para não brigar com um Postgres instalado localmente.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | API (:3333) + web (:5173), gerando antes o contrato e o client |
| `npm run build` | Build de tudo, com cache do Turbo |
| `npm run check-types` | Type-check de todos os pacotes |
| `npm run test` | Testes unitários e de integração (a API usa o banco `septo_test`, precisa do Postgres no ar) |
| `npm run test:e2e` | Playwright; sobe os servidores de dev sozinho (precisa do Postgres no ar) |
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

```bash
docker compose up -d --build
```

Sobe Postgres, API, web e Caddy. O Caddy serve `APP_DOMAIN` com HTTPS: certificado local para `localhost` e Let's Encrypt para um domínio real. Para publicar, aponte o DNS para a VPS, abra as portas 80 e 443 e defina `APP_DOMAIN` no `.env`. Troque também `POSTGRES_PASSWORD`.

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
