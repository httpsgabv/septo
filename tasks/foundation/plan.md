# Implementation Plan: foundation

> Spec: [SPEC-foundation](../../specs/SPEC-foundation.md) · Tarefas: [todo.md](todo.md) · Status: **aprovado — em execução**

## Overview

Substituir o scaffold do create-turbo pela base do septo: `@septo/api` (NestJS 12 + SWC + Prisma), `@septo/web` (TanStack Start), contrato zod → OpenAPI → Orval com docs no Scalar, design system `@septo/ui` com acento customizável, shell do app e stack Docker com Caddy. O plano ataca primeiro os riscos técnicos (pipeline de contrato e SSR) antes de investir em UI e infra.

## Grafo de dependências

```
T1 limpeza + Biome + tsconfig
 ├─▶ T2 API esqueleto (Nest + SWC + env + Vitest)
 │     └─▶ T3 pipeline zod → OpenAPI → Scalar  ◀── risco alto
 │           ├─▶ T5 Orval + axios + SSR  ◀── risco alto (depende de T4)
 │           ├─▶ T6 Postgres + Prisma + health com DB
 │           └─▶ T7 erros padronizados
 └─▶ T4 web esqueleto (TanStack Start)
       └─▶ T8 @septo/ui (tokens + acento)
             └─▶ T9 shell ─▶ T10 ⌘K
                        └─▶ T11 Configurações (tema + acento)
T5..T11 ─▶ T12 Docker + Caddy ─▶ T13 e2e ─▶ T14 pipeline Turbo + docs
```

## Architecture Decisions

- **Risco primeiro.** T3 e T5 provam o contrato ponta a ponta (schemas com opcional, nullable, enum e uuid passando de zod para OpenAPI e para o hook do Orval, e SSR repassando cookie) antes de qualquer UI. Se o `z.toJSONSchema` não se der bem com `@nestjs/swagger`/Orval, a gente descobre no início, não no meio do `notes`.
- **Health como fatia vertical de referência.** `/api/health` segue todas as camadas (controller → caso de uso → porta `DatabaseHealthCheck` → implementação Prisma) e vira o exemplo que os próximos módulos copiam.
- **O `openapi.json` é gerado sem abrir porta.** `src/openapi.ts` monta o documento; o `main.ts` e o script `openapi` usam a mesma função. Isso deixa o `codegen` do Turbo determinístico e com cache.
- **Um banco só no compose, dois databases.** `septo` (dev) e `septo_test` (integração), este criado por script de init do Postgres. Sem container extra.
- **Imagens Docker em `node:24-alpine`** (LTS), build multi-stage com `turbo prune --docker`.
- **Shadcn no monorepo:** `components.json` em `packages/ui` e em `apps/web`, então o CLI instala no pacote certo.

## Task List

### Fase 1: base e riscos técnicos
- [x] T1: Limpar o scaffold e configurar Biome e `@septo/typescript-config`
- [x] T2: Esqueleto da `@septo/api` (Nest 12 + SWC + env zod + Vitest)
- [x] T3: Pipeline zod → OpenAPI → Scalar + geração do `openapi.json`
- [x] T4: Esqueleto do `@septo/web` (TanStack Start + proxy `/api`)
- [x] T5: Codegen com Orval + axios, status da API no SSR

### Checkpoint A: contrato ponta a ponta
- [x] Mudar um campo no schema zod de resposta e rodar `codegen` quebra o `check-types` do web
- [x] `lint`, `check-types`, `test` passam
- [x] Revisão com você antes de seguir

### Fase 2: API (pode rodar em paralelo com a Fase 3)
- [x] T6: Postgres no compose + Prisma + health com checagem do banco
- [x] T7: `DomainError`, exception filter e formato padrão de erro

### Fase 3: design system e shell
- [x] T8: `@septo/ui`: Tailwind v4, tokens, tema e acento derivado
- [x] T9: Shell (sidebar, header, drawer mobile, páginas placeholder)
- [x] T10: Command palette ⌘K
- [x] T11: Configurações: tema e cor de acento sem flash

### Checkpoint B: app navegável
- [x] Shell funciona em desktop e em 375 px; acento persiste após reload
- [x] `/api/health` responde 200 e 503 corretamente
- [x] Revisão visual com você (aprovada)

### Fase 4: infra, e2e e docs
- [x] T12: Dockerfiles, compose completo e Caddy
- [x] T13: Suite e2e de fumaça (Playwright)
- [x] T14: Pipeline do Turbo (cache) e documentação (README, CLAUDE.md)

### Checkpoint final
- [x] Todos os Success Criteria da spec verificados
- [x] Clone limpo → `npm install && cp .env.example .env && docker compose up -d postgres && npm run dev` funciona
- [ ] Revisão final com você

## Paralelização

- Depois do Checkpoint A: **Fase 2** (T6–T7, só API) e **Fase 3** (T8–T11, só web/ui) não compartilham arquivos.
- T12 depende de ambas; T13–T14 são sequenciais no final.

## Risks and Mitigations

| Risco | Impacto | Mitigação |
|---|---|---|
| `z.toJSONSchema` gerando algo que o Swagger/Orval interpretam errado | Alto | T3 cobre opcional, nullable, enum, uuid e datas com teste de snapshot do `openapi.json`; plano B: pós-processar o schema no decorator |
| `@nestjs/swagger` 12 com SWC sem CLI plugin exige metadados explícitos | Médio | Os decorators `@Zod*` declaram tudo explicitamente; o plugin não é usado |
| Mutator axios no SSR do TanStack Start (repassar cookie, base URL interna) | Alto | T5 valida no SSR; o e2e da T13 cobre |
| TS 7.0 sem API programática quebra o `nest build` | ~~Médio~~ Resolvido | Confirmado na T2: API fixada em TS 6.0 até a 7.1 |
| Shadcn CLI em monorepo com Tailwind v4 | ~~Baixo~~ Ocorreu | O CLI quebra com o ponto no caminho do usuário no Windows; componentes baixados do registry com as mesmas transformações (ver spec) |
| `turbo prune` com npm workspaces no Docker | Médio | T12 valida o build das duas imagens a partir de um clone limpo |

## Open Questions

Nenhuma. (Git: branch `feat/foundation`, um commit por tarefa, Conventional Commits em inglês — aprovado.)
