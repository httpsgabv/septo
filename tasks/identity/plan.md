# Implementation Plan: identity

> Spec: [SPEC-identity](../../specs/SPEC-identity.md) · Tarefas: [todo.md](todo.md) · Status: **rascunho — aguardando aprovação**

## Overview

Proteger o septo atrás de um login de usuário único: tabela `users`, hash argon2id, sessão JWT em cookie httpOnly com revogação por `tokenVersion`, `AuthGuard` global na API, rota de layout `_app` com guard no web, e a seção Conta em Configurações. O plano constrói a API de baixo para cima (domínio → persistência → CLI → sessão → guard → login → perfil), prova o cookie no SSR antes de tocar na UI e só então liga o guard do web, com o e2e já autenticado para que as suítes existentes não quebrem.

## Grafo de dependências

```
T1 env + jose + migration User ─▶ T2 domínio (User, portas, erros)
                                    ├─▶ T3 adapters (argon2 + Prisma)  ◀── risco: crypto.argon2
                                    │     └─▶ T4 set-user (caso de uso + CLI)
                                    └─▶ T5 token service + cookie + kinds novos de DomainError
                                          └─▶ T6 AuthGuard + @Public + GET /me   (T3, T5)
                                                ├─▶ T7 rate limit (porta + memória)
                                                │     └─▶ T8 login + logout        (T4, T6)
                                                ├─▶ T9 PATCH /me
                                                ├─▶ T10 PUT /me/password
                                                └─▶ T11 DELETE /me/sessions
T8..T11 ─▶ T12 Set-Cookie no SSR + redirect  ◀── risco alto
T12 ─▶ T13 rotas para o layout _app (refactor)
T8, T13 ─▶ T14 e2e autenticado (septo_test + storageState)
T14 ─▶ T15 /login + guard do web ─▶ T16 menu do usuário + 401 no cliente
                                └─▶ T17 Conta: perfil e último login ─▶ T18 Conta: senha e sair de todos
T18 ─▶ T19 docs, env, Docker e fechamento
```

## Architecture Decisions

- **Risco primeiro.** T3 prova `crypto.argon2` (Node ≥ 24.7) com parâmetros OWASP e formato PHC antes de qualquer outra coisa depender dele; T12 prova o `Set-Cookie` da API chegando ao navegador numa navegação SSR (o ponto mais frágil do web) antes de existir tela de login.
- **Um commit por tarefa, contrato sempre em dia.** Toda tarefa que mexe em rota da API roda `npm run codegen` e commita `apps/api/openapi.json`, senão o teste de contrato quebra. Por isso não existe tarefa separada de "regenerar o contrato".
- **Guard antes do login.** O `AuthGuard` global (T6) entra com `GET /me` e `@Public()` no `health`; o login (T8) já nasce `@Public()`. Rota nova na API é protegida desde o primeiro dia do módulo.
- **Docs continuam públicos sem `@Public()`.** `/api/docs` e `/api/openapi.json` são montados por `app.use` no `main.ts`, fora do pipeline de guards do Nest; o teste da T6 só confirma que seguem respondendo `200`. (A spec cita os docs entre os `@Public()`; na prática só o `health` e o `auth/*` precisam do decorator.)
- **Testes de integração contra `septo_test` com migrations aplicadas.** T1 adiciona um `globalSetup` do Vitest que roda `prisma migrate deploy` no banco de teste, senão o primeiro teste com `users` falharia num banco vazio.
- **CLI sem HTTP.** `set-user.ts` sobe um `createApplicationContext` só com `SharedModule` e `IdentityModule` e chama `SetUserUseCase`; no build vira `dist/cli/set-user.js`, o caminho usado em produção (`docker exec`).
- **E2E autentica pela API.** O `global-setup` do Playwright faz `POST /api/auth/login` e grava o `storageState`; assim as suítes existentes rodam logadas sem depender da UI de login. O servidor de dev do e2e sobe com `DATABASE_URL` apontando para `septo_test`.
- **Conta como seção da rota `/settings`.** "Configurações → Conta" vira um bloco "Conta" acima de "Aparência" na mesma página, sem sub-rotas nem abas.
- **Migração das rotas em duas etapas.** T13 move `notes`, `dev-tools`, `settings` e o shell para `_app` sem mudar comportamento (e2e existente é a prova); T15 só acrescenta o guard e o `/login`.

## Task List

### Fase 1: usuário, hash e CLI (API)
- [x] T1: `JWT_SECRET`, dependência `jose`, model `User` + primeira migration e setup do banco de teste
- [x] T2: Domínio do identity: entidade `User`, política de senha, portas e erros
- [x] T3: Adapters: hasher argon2id e repositório Prisma
- [x] T4: `SetUserUseCase` + CLI `user:set`

### Checkpoint A: usuário existe
- [ ] `npm run user:set -w @septo/api -- gabriel` cria e, na segunda execução, reseta (`tokenVersion` sobe)
- [ ] `lint`, `check-types`, `test` passam
- [ ] Revisão com você antes de seguir

### Fase 2: sessão e API protegida
- [x] T5: Token service (JWT), helper do cookie de sessão e `DomainError` `unauthenticated` / `rate_limited`
- [x] T6: `AuthGuard` global, `@Public()`, `@CurrentUser()` e `GET /api/me` (com renovação deslizante)
- [x] T7: Limite de tentativas de login (porta + implementação em memória)
- [ ] T8: `POST /api/auth/login` e `POST /api/auth/logout`

### Checkpoint B: API autenticada ponta a ponta
- [ ] `curl`: login → cookie → `GET /api/me` 200; sem cookie 401; 6ª falha 429 com `Retry-After`
- [ ] `/api/health` e `/api/docs` seguem `200` sem cookie
- [ ] Revisão com você antes de seguir

### Fase 3: perfil e revogação (API)
- [ ] T9: `PATCH /api/me`
- [ ] T10: `PUT /api/me/password`
- [ ] T11: `DELETE /api/me/sessions`

### Fase 4: web
- [ ] T12: Repassar `Set-Cookie` da API no SSR e validador de `?redirect=`
- [ ] T13: Mover shell e rotas para o layout `_app` (refactor, sem mudança de comportamento)
- [ ] T14: E2E autenticado: banco `septo_test`, usuário de teste e `storageState`
- [ ] T15: Tela `/login` e guard do web
- [ ] T16: Menu do usuário (Sair) e tratamento de `401` no cliente
- [ ] T17: Configurações → Conta: nome de exibição e último login
- [ ] T18: Configurações → Conta: trocar senha e sair de todos os dispositivos

### Checkpoint C: fluxo completo no navegador
- [ ] `/notes` sem sessão → `/login?redirect=/notes` → login → `/notes`; `?redirect=//evil.com` ignorado
- [ ] SSR de página protegida sem flash de conteúdo deslogado
- [ ] `test:e2e` passa (suítes existentes autenticadas + novas)
- [ ] Revisão visual com você (desktop e 375 px)

### Fase 5: fechamento
- [ ] T19: `.env.example`, README, CLAUDE.md, CAPABILITY-MAP, imagem Docker com o CLI

### Checkpoint final
- [ ] Todos os Success Criteria da spec verificados
- [ ] Clone limpo → `npm install && cp .env.example .env && docker compose up -d && npm run user:set -w @septo/api -- <user> && npm run dev` funciona
- [ ] Revisão final com você

## Paralelização

- Depois do Checkpoint B: **T9, T10 e T11** (só API, arquivos distintos, mas todos tocam `me.controller.ts` e `openapi.json`) — melhor sequenciais, ou paralelos em worktrees com merge cuidadoso.
- **T12** (só web) pode andar em paralelo com T9–T11: não compartilha arquivos com a API.
- T13–T18 são sequenciais (mesmas rotas e o mesmo `routeTree.gen.ts`).

## Risks and Mitigations

| Risco | Impacto | Mitigação |
|---|---|---|
| `crypto.argon2` ausente ou com API diferente no Node local (26) ou na imagem `node:24-alpine` | Alto | T3 roda o hasher real em teste e T19 valida o CLI dentro da imagem; plano B da spec: adapter com `@node-rs/argon2` sem mexer na porta (pede aprovação) |
| `Set-Cookie` da API não chega ao navegador em navegação SSR (mutator só repassa `cookie` hoje) | Alto | T12 resolve com `setResponseHeader` do TanStack Start e prova com `curl` de token com mais de 15 dias; e2e da T15 cobre o redirecionamento |
| Cookie `Secure` em `http://localhost` no Playwright (`storageState` e `APIRequestContext`) | Médio | T14 valida cedo, antes de ligar o guard do web; plano B: `secure` desligado só quando `NODE_ENV=test` (pede aprovação, é mudança nas flags do cookie) |
| `reuseExistingServer` faz o e2e reaproveitar um dev server apontando para o banco `septo` | Médio | T14 passa `reuseExistingServer: false` e o `DATABASE_URL` de `septo_test` no `webServer`: o e2e exige as portas 5173/3333 livres (pare o `npm run dev` antes) e isso vai para o README |
| Mover rotas para `_app` quebra `routeTree.gen.ts`, links tipados e os testes de navegação | Médio | T13 é refactor puro, com e2e e `check-types` como rede; só depois vem o guard |
| Rate limit por IP atrás do Caddy com `trust proxy` errado (todos os clientes viram o mesmo IP) | Médio | T8 testa `X-Forwarded-For` com `trust proxy = 1`; em dev direto, `req.ip` é o loopback |
| Guard consulta o banco a cada request, inclusive em `/api/me` disparado pelo SSR | Baixo | Um usuário só; sem cache (aceito na spec) |
| Prisma 7 com `@db.Uuid` e `@default(uuid())` na primeira migration | Baixo | T1 aplica a migration em `septo` e `septo_test` antes de seguir |

## Open Questions

- **"Último login" mostra o login atual.** `recordLogin` grava `lastLoginAt`/`lastLoginIp` a cada login, então logo depois de entrar o valor exibido em Configurações → Conta é o da própria sessão, o que serve pouco para notar um acesso estranho. A spec pede exatamente isso, e a T17 segue a spec. Se você quiser ver o login *anterior*, é preciso guardar o penúltimo (`previousLoginAt`/`previousLoginIp` em `users`) e isso muda a spec antes da T1.
- **Cobertura ≥ 90% em `domain/` e `application/`**: o repo não tem `@vitest/coverage-v8` instalado. Para *medir* a meta, a T19 precisaria adicionar essa devDependency (fora da tabela de Tech Stack, pede aprovação). Padrão: adicionar e medir só no identity; se preferir não, a meta fica como diretriz de TDD, sem número medido.
- **Nome dos arquivos**: você pediu "todo.md e tasks.md"; segui o padrão do foundation (`plan.md` = plano e decisões, `todo.md` = tarefas com aceite). Se `tasks.md` era outro arquivo, me diga.
