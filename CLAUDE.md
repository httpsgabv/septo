# septo — contexto para agentes

App pessoal que centraliza ferramentas (notas/lembretes, dev tools). Monorepo Turborepo + npm.

## Leia antes de mudar algo

1. [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — módulos (ids estáveis), ordem de build, decisões globais.
2. [specs/SPEC-foundation.md](specs/SPEC-foundation.md) — convenções globais: camadas, contrato da API, design system, testes e limites (Always / Ask first / Never).
3. A spec do módulo em que vai trabalhar (`specs/SPEC-<id>.md`) e suas tarefas (`tasks/<id>/todo.md`).

## Fluxo de trabalho

- Spec-driven: mapa → spec → plano/tarefas → implementação, com aprovação do usuário a cada fase. Pergunte quando houver dúvida.
- Decisão mudou? Atualize spec/mapa **antes** de implementar a mudança.
- Branch por módulo (`feat/<id>`), um commit por tarefa, Conventional Commits em inglês (semantic versioning no CI).
- Toda tarefa termina com `npm run lint`, `npm run check-types` e `npm run test` passando (Postgres no ar: `docker compose up -d postgres`).
- UI em PT-BR; código, commits e identificadores em inglês.

## Armadilhas conhecidas

- **API em TypeScript 6** (Nest CLI precisa da API do compilador, ausente no TS 7.0); web e pacotes em TS 7.
- **API é ESM**: imports relativos terminam em `.js`.
- **Contrato**: schemas zod em `presentation` → `npm run codegen` → commitar `apps/api/openapi.json`. Nunca editar `apps/web/src/shared/api/generated/`.
- **operationId** = `<controller><Método>` (`HealthController.check` → `healthCheck` → `useHealthCheck`).
- **CLI do shadcn quebra nesta máquina** (ponto no caminho do usuário; já instalou o pacote npm errado `cn`). Baixe componentes do registry `base-nova` aplicando as transformações descritas na spec do foundation.
- **Texto em acento** usa `text-brand-text`, nunca `text-primary`.
- **Postgres do container na porta 5433** do host (há um Postgres local na 5432).
- **e2e**: espere `body[data-hydrated]` (helper `gotoHydrated`) antes de interagir.
