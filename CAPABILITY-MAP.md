# Capability Map: septo v1

> Status: **aprovado** em 2026-09-18. Os ids dos módulos são estáveis — não renomear.
> Este arquivo é o índice das specs. Cada módulo tem sua spec em `specs/SPEC-<id>.md` e seu plano/tarefas em `tasks/<id>/`.

septo é um app pessoal que centraliza ferramentas hoje espalhadas em N apps avulsos.

| Module id | Responsabilidade | Depende de | Spec |
|---|---|---|---|
| `foundation` | Monorepo (TanStack Start + NestJS), contrato zod → OpenAPI (Scalar) → Orval, Docker Compose (Postgres, Caddy/HTTPS), design system `@septo/ui`, shell do app, convenções globais | — | [SPEC-foundation](specs/SPEC-foundation.md) · [plano](tasks/foundation/plan.md) · ✅ implementado |
| `identity` | Login de usuário único (username + senha), sessão JWT em cookie httpOnly, guard de rotas (API e web), perfil (nome de exibição), troca de senha, sair de todos | foundation | [SPEC-identity](specs/SPEC-identity.md) · [plano](tasks/identity/plan.md) · ✅ implementado |
| `notes` | Notas markdown: CRUD, tags, fixar, arquivar, busca. Lembrete = nota com `remindAt` | identity | [SPEC-notes](specs/SPEC-notes.md) · [plano](tasks/notes/plan.md) · ✅ implementado |
| `reminders` | Web Push: assinaturas, scheduler na API, disparo, service worker/PWA | notes | _pendente_ |
| `dev-tools` | Formatador JSON, gerador RSA, conversor (imagens, dados, encodings), leitor de README — 100% no navegador | foundation | [SPEC-dev-tools](specs/SPEC-dev-tools.md) · [plano](tasks/dev-tools/plan.md) · 🚧 em andamento |

**Ordem de build:** `foundation` → `identity` → `notes` → `reminders`; `dev-tools` em paralelo após `foundation`.

## Pacotes do monorepo

```
apps/api            @septo/api — NestJS, um módulo por bounded context (domain/application/infrastructure/presentation); gera openapi.json
apps/web            @septo/web — TanStack Start, src/features/<contexto>; client gerado pelo Orval
packages/ui         @septo/ui — design system (shadcn base-nova + Base UI + Tailwind v4, tokens)
packages/typescript-config  @septo/typescript-config
```

Separações deliberadamente **não** feitas (reavaliar quando houver 2º consumidor):
- domínio de notas como pacote — só a API consome;
- lógica de dev-tools como pacote — só o front consome;
- `@septo/contracts` — tipos e schemas zod do web vêm do Orval (aprovado).

## Decisões globais aprovadas

| Tema | Decisão |
|---|---|
| Deploy | VPS, usuário único. Compose só com infra (Postgres + Caddy); API e web como imagens Docker avulsas na rede `septo`. Caddy com HTTPS também em dev |
| Auth | username + senha (argon2id do `node:crypto`), usuário único na tabela `users` criado por CLI, sessão JWT (30 dias, deslizante) em cookie httpOnly, revogação por `tokenVersion`, sem signup — revisado em 2026-09-18 (antes: e-mail + hash em env) |
| Banco | PostgreSQL + Prisma |
| Lembretes | Web Push (VAPID), sem recorrência na v1, scheduler por polling de 1 min |
| Conversor | imagens, dados estruturados (JSON/YAML/CSV/XML), encodings |
| Dev-tools | client-side, sem persistência; RSA via WebCrypto |
| Idioma | UI em PT-BR; código, commits e identificadores em inglês |
| Package manager | npm workspaces; escopo `@septo/*` |
| Comunicação | REST; zod na API → OpenAPI (`@nestjs/swagger`) → client Orval (axios + TanStack Query); docs no Scalar em `/api/docs`. Sem tRPC |
| Schemas | zod 4 |
| Lint/format | Biome (sem ESLint/Prettier) |
| TypeScript | 7.0 no web e nos pacotes; API em 6.0 (Nest CLI precisa da API do compilador, ausente no 7.0) compilando com SWC |
| Visual | premium minimalista, dark-first, estilo Linear/Raycast; acento customizável, default `#5808a3` |
| Primitivas de UI | Base UI (shadcn `base-nova`), no lugar de Radix — decidido em 2026-09-18 |
| Domínio | `APP_DOMAIN` em env, default `localhost` |
| Testes | Vitest (unit/integration) + Playwright (e2e) |
| Notas | Markdown na coluna `body`; editor WYSIWYG Tiptap 3 com ponte própria (`prosemirror-markdown`) em `features/notes/domain/markdown.ts`; busca por substring sobre `searchText` derivado; sem `ownerId` (um usuário só) — 2026-09-20 |
