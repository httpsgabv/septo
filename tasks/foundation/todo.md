# Tarefas: foundation

> Plano: [plan.md](plan.md) · Spec: [SPEC-foundation](../../specs/SPEC-foundation.md)
> Regra geral: toda tarefa termina com `npm run lint`, `npm run check-types` e `npm run test` passando.
> Tarefas de scaffolding mexem em mais de 5 arquivos porque são configuração; a lógica em si fica pequena.

---

## Fase 1: base e riscos técnicos

### T1: Limpar o scaffold e configurar Biome e `@septo/typescript-config`

**Descrição:** Remover o que veio do create-turbo e não será usado. Trocar ESLint/Prettier por Biome e renomear o pacote de tsconfig para o escopo `@septo`.

**Aceite:**
- [ ] `apps/docs`, `apps/web` (Next), `packages/eslint-config` e os componentes demo de `packages/ui` removidos; Prettier fora do `package.json` raiz
- [ ] `packages/typescript-config` publicado como `@septo/typescript-config`, com presets `base.json`, `nest.json` (decorators) e `react.json`
- [ ] `biome.json` na raiz (ignora `**/generated/**`, `dist`, `.output`, `.turbo`, com suporte a diretivas do Tailwind); scripts `lint` e `format` na raiz; `turbo.json` sem a task `lint`

**Verificação:**
- [ ] `npm install` sem erro; `npm run lint` passa
- [ ] `grep -r "@repo/" --include=package.json .` não retorna nada

**Dependências:** nenhuma
**Arquivos:** `package.json`, `turbo.json`, `biome.json`, `packages/typescript-config/*`, `.gitignore`; remoção de `apps/docs`, `apps/web`, `packages/eslint-config`, `packages/ui/src/*`
**Tamanho:** M

---

### T2: Esqueleto da `@septo/api` (Nest 12 + SWC + env zod + Vitest)

**Descrição:** Criar a API NestJS mínima com build via SWC, prefixo global `/api`, env validada com zod e Vitest configurado com `unplugin-swc`. Health ainda sem banco: `GET /api/health` → `{ status: "ok" }`.

**Aceite:**
- [ ] `npm run dev -w @septo/api` sobe em `:3333`; `GET /api/health` retorna 200
- [ ] Faltar variável obrigatória derruba o boot com mensagem clara (zod)
- [ ] `check-types` (TS 7, preset `nest.json`) e `build` (`nest build --builder swc`) passam; DI por tipo de construtor funciona no binário buildado

**Verificação:**
- [ ] `npm run test -w @septo/api` (unit do schema de env + integração do health com supertest)
- [ ] `npm run build -w @septo/api && node apps/api/dist/main.js` responde no health

**Dependências:** T1
**Arquivos:** `apps/api/package.json`, `apps/api/nest-cli.json`, `apps/api/.swcrc`, `apps/api/vitest.config.ts`, `apps/api/src/{main,app.module}.ts`, `apps/api/src/shared/env.ts`, `apps/api/src/modules/health/presentation/health.controller.ts`, `apps/api/test/health.spec.ts`
**Tamanho:** M

---

### T3: Pipeline zod → OpenAPI → Scalar + geração do `openapi.json` ⚠️ risco alto

**Descrição:** Implementar `ZodValidationPipe` e os decorators `@ZodBody`, `@ZodQuery`, `@ZodParams` e `@ZodResponse` usando `z.toJSONSchema(schema, { target: 'openapi-3.0' })`. Montar o documento em `src/openapi.ts`, servir o Scalar em `/api/docs` e o JSON em `/api/openapi.json` (se `API_DOCS_ENABLED`), e criar o script `openapi` que grava `apps/api/openapi.json` sem abrir porta. O health passa a declarar o schema de resposta.

**Aceite:**
- [ ] Um schema de teste com campo opcional, nullable, enum, uuid e data aparece corretamente no `openapi.json` (snapshot)
- [ ] Entrada inválida nos decorators de entrada é rejeitada com 400
- [ ] `/api/docs` mostra o health documentado com o schema de resposta; `npm run openapi -w @septo/api` gera o arquivo de forma determinística (rodar duas vezes gera diff zero)

**Verificação:**
- [ ] `npm run test -w @septo/api` (unit do pipe e dos decorators; snapshot do documento)
- [ ] Manual: abrir `http://localhost:3333/api/docs`

**Dependências:** T2
**Arquivos:** `apps/api/src/shared/http/zod-validation.pipe.ts`, `apps/api/src/shared/http/zod.decorators.ts`, `apps/api/src/openapi.ts`, `apps/api/scripts/generate-openapi.ts`, `apps/api/src/main.ts`, `apps/api/openapi.json`
**Tamanho:** M

---

### T4: Esqueleto do `@septo/web` (TanStack Start + proxy `/api`)

**Descrição:** Criar o app TanStack Start em `:5173` com root route, uma rota index, proxy do Vite para `/api` → `:3333`, env do servidor validada com zod e Vitest configurado.

**Aceite:**
- [ ] `npm run dev -w @septo/web` sobe em `:5173` com SSR funcionando (HTML inicial já contém o conteúdo)
- [ ] `http://localhost:5173/api/health` chega na API pelo proxy
- [ ] `check-types` (TS 7, preset `react.json`) e `build` passam

**Verificação:**
- [ ] `npm run build -w @septo/web`; `npm run test -w @septo/web` (unit do schema de env)
- [ ] Manual: `curl http://localhost:5173` retorna HTML renderizado no servidor

**Dependências:** T1
**Arquivos:** `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/router.tsx`, `apps/web/src/routes/{__root,index}.tsx`, `apps/web/src/shared/env.ts`
**Tamanho:** M

---

### T5: Codegen com Orval + axios, status da API no SSR ⚠️ risco alto

**Descrição:** Configurar o Orval (saída `react-query` com axios + saída `zod`) lendo `apps/api/openapi.json`. Criar o mutator `http-client.ts`: `baseURL` `/api` no navegador; no SSR, `API_INTERNAL_URL` repassando o header `cookie` da requisição. Criar a task `codegen` no Turbo (web depende de `^openapi`) e fazer a home mostrar o status da API carregado no loader (SSR) com o hook gerado. Adicionar o teste de contrato na API (o `openapi.json` commitado é igual ao gerado).

**Aceite:**
- [ ] `npm run codegen` gera `apps/web/src/shared/api/generated/` (gitignored) a partir do `openapi.json`
- [ ] A home renderiza o status da API já no HTML do SSR e revalida no cliente
- [ ] Remover `status` do schema zod de resposta do health e rodar `codegen` quebra o `check-types` do web (Success Criterion 3); o teste de contrato falha se o `openapi.json` estiver desatualizado

**Verificação:**
- [ ] `npm run codegen && npm run check-types && npm run test`
- [ ] Manual: `curl http://localhost:5173` contém o status; o teste de quebra de tipo é feito e revertido

**Dependências:** T3, T4
**Arquivos:** `apps/web/orval.config.ts`, `apps/web/src/shared/api/http-client.ts`, `apps/web/src/routes/index.tsx`, `turbo.json`, `apps/api/test/openapi-contract.spec.ts`
**Tamanho:** M

### ✅ Checkpoint A: contrato ponta a ponta
- [ ] `npm run lint && npm run check-types && npm run test` passam
- [ ] Quebra de contrato propagando até o web demonstrada
- [ ] **Revisão com você antes da Fase 2/3**

---

## Fase 2: API

### T6: Postgres no compose + Prisma + health com checagem do banco

**Descrição:** Adicionar `compose.yaml` com o serviço `postgres` (volume, healthcheck, script de init que cria `septo_test`) e `.env.example`. Configurar Prisma 7.10 com `prisma.config.ts` e `@prisma/adapter-pg`, `PrismaService` em `shared`. Refatorar o health para a fatia de referência: porta `DatabaseHealthCheck` (domain) → `CheckHealthUseCase` (application) → `PrismaDatabaseHealthCheck` (infrastructure, `SELECT 1`) → controller retornando 200 `{status:"ok",db:"up"}` ou 503 `{status:"degraded",db:"down"}`.

**Aceite:**
- [ ] `docker compose up -d postgres` sobe o banco com `septo` e `septo_test`
- [ ] Health retorna 200 com o banco no ar e 503 com o banco fora
- [ ] Prisma importado só em `infrastructure` e `shared/prisma`

**Verificação:**
- [ ] Unit do caso de uso com fake da porta; integração contra `septo_test`
- [ ] Manual: `docker compose stop postgres` → health 503

**Dependências:** T3 (a T5 precisa estar concluída para regenerar o client)
**Arquivos:** `compose.yaml`, `docker/postgres/init.sql`, `.env.example`, `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`, `apps/api/src/shared/prisma.service.ts`, `apps/api/src/modules/health/**`
**Tamanho:** M

---

### T7: `DomainError`, exception filter e formato padrão de erro

**Descrição:** Criar a classe base `DomainError` (com `code` e status HTTP associado) e o exception filter global que converte `DomainError`, erro de validação zod e `HttpException` em `{ code, message, details? }`; erros inesperados viram 500 sem vazar stack. Schema `ErrorResponse` registrado no OpenAPI e usado pelo `@ZodResponse` nos casos de erro.

**Aceite:**
- [ ] Entrada inválida → `400 { code: "VALIDATION_ERROR", message, details }`
- [ ] `DomainError` → status mapeado com o `code` do erro; erro desconhecido → `500 { code: "INTERNAL_ERROR" }` e log com stack
- [ ] `ErrorResponse` aparece no `openapi.json` e no client gerado

**Verificação:**
- [ ] Unit do filter (um caso por tipo de erro); integração via endpoint de teste só nos testes

**Dependências:** T3
**Arquivos:** `apps/api/src/shared/domain-error.ts`, `apps/api/src/shared/http/exception.filter.ts`, `apps/api/src/shared/http/error-response.schema.ts`, `apps/api/src/main.ts`, `apps/api/src/shared/http/exception.filter.spec.ts`
**Tamanho:** S

---

## Fase 3: design system e shell

### T8: `@septo/ui`: Tailwind v4, tokens, tema e acento derivado

**Descrição:** Configurar `packages/ui` com Tailwind v4 (`@theme`), tokens (zinc, raios, sombras, Geist Sans/Mono), temas claro/escuro e `--accent-base` (default `#5808a3`) com as variantes derivadas via `oklch(from …)`. Inicializar o shadcn no monorepo e adicionar os primeiros componentes: button, input, card, dialog, dropdown-menu, tooltip, separator, sheet. O web importa o CSS e os componentes por subpath.

**Aceite:**
- [ ] Trocar `--accent-base` no DevTools recolore botões, foco e links do app inteiro
- [ ] O texto em cor de acento tem contraste ≥ 4.5:1 nos dois temas com o default `#5808a3` (verificação documentada)
- [ ] O web usa `@septo/ui/button` com o tema aplicado; `check-types` e `build` passam

**Verificação:**
- [ ] `npm run build`; manual: página de exemplo temporária na index com os componentes nos dois temas

**Dependências:** T4
**Arquivos:** `packages/ui/package.json`, `packages/ui/components.json`, `packages/ui/src/styles/globals.css`, `packages/ui/src/components/*`, `packages/ui/src/lib/utils.ts`, `apps/web/components.json`
**Tamanho:** M

---

### T9: Shell (sidebar, header, drawer mobile, páginas placeholder)

**Descrição:** Layout raiz com sidebar colapsável (Notas, Dev Tools, Configurações), header e drawer (`Sheet`) em telas < 768 px. Rotas `/notes`, `/dev-tools` e `/settings` com placeholders; status da API da T5 vai para o rodapé da sidebar.

**Aceite:**
- [ ] A navegação entre as três rotas funciona e o item ativo fica destacado
- [ ] Em 375 px: drawer abre/fecha, sem scroll horizontal
- [ ] Navegável só com teclado (tab, enter, esc fecha o drawer)

**Verificação:**
- [ ] `npm run check-types && npm run build`; manual em 1440 px e 375 px

**Dependências:** T8
**Arquivos:** `apps/web/src/shared/layout/{app-shell,sidebar,header}.tsx`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/{notes,dev-tools,settings}.tsx`
**Tamanho:** M

---

### T10: Command palette ⌘K

**Descrição:** Adicionar o componente `command` do shadcn (cmdk) ao `@septo/ui` e montar a palette no shell: abre com ⌘K / Ctrl+K e com botão no header, lista as seções navegáveis e navega ao selecionar. A lista de itens vem da mesma fonte que a sidebar.

**Aceite:**
- [ ] ⌘K/Ctrl+K abre a palette; digitar filtra; enter navega; esc fecha
- [ ] Sidebar e palette usam a mesma definição de navegação (um array só)

**Verificação:**
- [ ] Manual só com teclado (a navegação é um dado estático, não pede teste unitário); coberto no e2e da T13

**Dependências:** T9
**Arquivos:** `packages/ui/src/components/command.tsx`, `apps/web/src/shared/layout/command-palette.tsx`, `apps/web/src/shared/navigation.ts`, `apps/web/src/shared/layout/header.tsx`
**Tamanho:** S

---

### T11: Configurações: tema e cor de acento sem flash

**Descrição:** Página `/settings` com toggle de tema (claro/escuro/sistema) e seletor de acento (presets + `<input type="color">`). Salva em `localStorage`; um script inline no `<head>` aplica tema e acento antes da primeira pintura. Função pura de validação da cor (hex) em `features/settings/domain`.

**Aceite:**
- [ ] Trocar a cor recolore o app na hora; recarregar mantém a cor sem flash do roxo default
- [ ] Tema "sistema" acompanha `prefers-color-scheme`
- [ ] Valor inválido ou `localStorage` indisponível cai no default sem quebrar

**Verificação:**
- [ ] Unit da validação/parse das preferências; manual com reload e aba anônima

**Dependências:** T9
**Arquivos:** `apps/web/src/routes/settings.tsx`, `apps/web/src/features/settings/domain/preferences.ts`, `apps/web/src/features/settings/domain/preferences.spec.ts`, `apps/web/src/features/settings/components/accent-picker.tsx`, `apps/web/src/routes/__root.tsx`
**Tamanho:** M

### ✅ Checkpoint B: app navegável
- [ ] Todos os testes passam; build limpo
- [ ] Shell, ⌘K e Configurações funcionando em desktop e em 375 px
- [ ] **Revisão visual com você**

---

## Fase 4: infra, e2e e docs

### T12: Dockerfiles, compose completo e Caddy

**Descrição:** Dockerfiles multi-stage (`node:24-alpine`, `turbo prune --docker`) para api e web; `compose.yaml` com `api`, `web` e `caddy` (depends_on com healthchecks); `Caddyfile` usando `{$APP_DOMAIN}` com `/api/*` → api e o resto → web. A API aplica `prisma migrate deploy` no start.

**Aceite:**
- [ ] `docker compose up -d --build` sobe os quatro serviços saudáveis
- [ ] `https://localhost` serve o web; `https://localhost/api/health` e `/api/docs` respondem via Caddy
- [ ] O SSR dentro do container usa `API_INTERNAL_URL=http://api:3333`

**Verificação:**
- [ ] Manual: `docker compose ps` todos healthy; `curl -k https://localhost/api/health`

**Dependências:** T6, T11
**Arquivos:** `apps/api/Dockerfile`, `apps/web/Dockerfile`, `compose.yaml`, `Caddyfile`, `.dockerignore`
**Tamanho:** M

---

### T13: Suite e2e de fumaça (Playwright)

**Descrição:** Configurar o Playwright no `@septo/web` (webServer subindo api+web em dev) e cobrir: shell carrega com o status da API renderizado no SSR; navegação pela sidebar e pela ⌘K; acento trocado persiste após reload; em 375 px o drawer funciona e não há scroll horizontal.

**Aceite:**
- [ ] `npm run test:e2e` passa localmente em Chromium
- [ ] Cada Success Criterion de UI da spec (5, 6) tem pelo menos um teste

**Verificação:**
- [ ] `npm run test:e2e`

**Dependências:** T11 (T12 não é necessária: roda contra o dev)
**Arquivos:** `apps/web/playwright.config.ts`, `apps/web/e2e/shell.spec.ts`, `apps/web/e2e/settings.spec.ts`, `package.json`, `turbo.json`
**Tamanho:** S

---

### T14: Pipeline do Turbo (cache) e documentação

**Descrição:** Ajustar `turbo.json` (inputs/outputs de `build`, `codegen`, `openapi`, `test`, `check-types`; env vars declaradas) até a segunda execução do `build` dar 100% de cache hit. Reescrever o README (visão, comandos, arquitetura resumida), criar o `CLAUDE.md` (aponta para o CAPABILITY-MAP, as specs, as convenções e os comandos) e marcar o `foundation` como concluído no CAPABILITY-MAP.

**Aceite:**
- [ ] `npm run build` duas vezes seguidas → a segunda com `FULL TURBO`
- [ ] Um clone limpo segue o README e chega ao app rodando sem passos extras
- [ ] Docs refletem o estado real (nenhuma referência a Next, ESLint, tRPC ou `@repo`)

**Verificação:**
- [ ] `npm run build && npm run build`; clone limpo em pasta temporária seguindo o README

**Dependências:** T12, T13
**Arquivos:** `turbo.json`, `README.md`, `CLAUDE.md`, `CAPABILITY-MAP.md`
**Tamanho:** S

### ✅ Checkpoint final
- [ ] Success Criteria 1–10 da spec verificados um a um
- [ ] **Revisão final com você**
