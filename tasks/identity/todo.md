# Tarefas: identity

> Plano: [plan.md](plan.md) · Spec: [SPEC-identity](../../specs/SPEC-identity.md)
> Branch: `feat/identity` · um commit por tarefa (Conventional Commits, em inglês).
> Regra geral: toda tarefa termina com `npm run lint`, `npm run check-types` e `npm run test` passando (infra no ar: `docker compose up -d`).
> Tarefa que mexe em rota da API também roda `npm run codegen` e commita `apps/api/openapi.json` (o teste de contrato falha se estiver desatualizado). Todo erro documentado vai com `@ZodResponse(<status>, errorResponse)`.
> Camadas: Prisma só em `infrastructure`; `domain` sem framework; portas são `abstract class`; imports relativos da API terminam em `.js`.

---

## Fase 1: usuário, hash e CLI (API)

### T1: `JWT_SECRET`, dependência `jose`, model `User` + primeira migration e setup do banco de teste

**Descrição:** Preparar a base do módulo: variável `JWT_SECRET` validada no env, dependência `jose`, o model `User` da spec com a primeira migration do projeto e um `globalSetup` do Vitest que aplica as migrations em `septo_test`. Sem lógica de negócio ainda.

**Aceite:**
- [x] `env.ts` valida `JWT_SECRET`: em dev/test/CI tem default fixo; com `NODE_ENV=production` é obrigatório e precisa de ≥ 32 caracteres, senão o boot falha com mensagem clara
- [x] `apps/api/prisma/schema.prisma` com o model `User` exatamente como na spec; migration `prisma/migrations/<ts>_create_users` aplicada em `septo` e em `septo_test`
- [x] `jose` 6 em `apps/api/package.json`; `engines.node` do root e do api em `>=24.7`
- [x] `apps/api/test/global-setup.ts` roda `prisma migrate deploy` contra o banco de teste antes da suíte (configurado em `vitest.config.ts`)

**Verificação:**
- [x] `npm run test -w @septo/api` (unit do `env.ts`: produção sem `JWT_SECRET`, com 31 caracteres, com 32; dev sem a variável)
- [x] `npm run db:migrate -w @septo/api` cria a tabela; suíte existente continua verde em banco recém-criado (`docker compose down -v && up -d`, depois `npm run test`)

**Dependências:** nenhuma
**Arquivos:** `apps/api/src/shared/env.ts`, `apps/api/src/shared/env.spec.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`, `apps/api/vitest.config.ts`, `apps/api/test/global-setup.ts`, `apps/api/package.json`, `package.json`
**Tamanho:** M

---

### T2: Domínio do identity: entidade `User`, política de senha, portas e erros

**Descrição:** TS puro, sem framework, com TDD. A entidade `User` sabe trocar a senha (recebe o hash novo, incrementa `tokenVersion`), revogar sessões (incrementa `tokenVersion`), editar o perfil (`displayName` com 1–50 caracteres, sem espaços nas pontas) e registrar login (`lastLoginAt`, `lastLoginIp`). A política de senha (12–128 caracteres) vive no domínio e é usada pela API e pelo CLI. Portas: `UserRepository`, `PasswordHasher`, `TokenService`, `LoginAttempts`.

**Aceite:**
- [x] `User` cobre criação (`displayName` = `username`), `changePassword`, `revokeSessions`, `updateProfile`, `recordLogin`; cada mutação de senha ou de sessões incrementa `tokenVersion`
- [x] `validatePassword` rejeita < 12 e > 128 caracteres e aceita os limites exatos, sem outras regras de composição
- [x] Erros de domínio (`kind: 'invalid'`) com `code`: `INVALID_CURRENT_PASSWORD`, `WEAK_PASSWORD`, `INVALID_DISPLAY_NAME`. Os de `unauthenticated` e `rate_limited` nascem na T5, junto com os `kind`s novos
- [x] Portas declaradas como `abstract class`; nenhum import de Nest, Prisma ou `node:crypto` em `domain/`

**Verificação:**
- [x] `npm run test -w @septo/api` (unit de `user.spec.ts` e `password-policy.spec.ts`, escritos antes da implementação)
- [x] `grep -rn "@nestjs\|generated/prisma\|node:" apps/api/src/modules/identity/domain` não retorna nada

**Dependências:** T1
**Arquivos:** `apps/api/src/modules/identity/domain/{user,user.spec,user.repository,password-hasher,token-service,login-attempts,errors}.ts`, `apps/api/src/modules/identity/domain/password-policy.ts` (+ spec)
**Tamanho:** M

---

### T3: Adapters: hasher argon2id e repositório Prisma ⚠️ risco: `crypto.argon2`

**Descrição:** Implementar `PasswordHasher` com `crypto.argon2` do `node:crypto` (argon2id, m = 19 MiB, t = 2, p = 1, salt aleatório, saída em formato PHC) e `UserRepository` com Prisma (mapper Prisma ↔ domínio, sem vazar o model). Cria o `IdentityModule` ligando as portas às implementações.

**Aceite:**
- [x] `hash()` gera string PHC `$argon2id$v=19$m=19456,t=2,p=1$...`; `verify()` aceita a senha certa, rejeita a errada e devolve `false` (não lança) para PHC malformado
- [x] `verify()` compara em tempo constante (`timingSafeEqual`)
- [x] `UserRepository`: `findByUsername`, `findById`, `count`/`findFirst` (para o CLI), `save` (cria e atualiza, incluindo `tokenVersion`, `lastLogin*`); mapper converte `null` ↔ `null`, `Date` ↔ `Date`
- [x] `IdentityModule` registrado no `AppModule`; DI resolve por tipo de construtor com o build SWC

**Verificação:**
- [x] `npm run test -w @septo/api` (hasher real: hash, verificação, senha errada, PHC inválido, dois hashes da mesma senha diferem; repositório contra `septo_test`, com limpeza da tabela entre testes)
- [x] `npm run build -w @septo/api && node apps/api/dist/main.js` sobe sem erro de DI

**Dependências:** T2
**Arquivos:** `apps/api/src/modules/identity/infrastructure/{argon2-password-hasher,user.prisma-repository}.ts` (+ specs), `apps/api/src/modules/identity/identity.module.ts`, `apps/api/src/app.module.ts`
**Tamanho:** M

---

### T4: `SetUserUseCase` + CLI `user:set`

**Descrição:** Caso de uso que cria o usuário único ou, se já existe, troca username e senha e incrementa `tokenVersion` (derruba todas as sessões). O CLI (`src/cli/set-user.ts`) pede a senha duas vezes sem eco em TTY, ou lê a primeira linha de `stdin` quando não é TTY (sem confirmação), valida com a política de senha e chama o caso de uso via `createApplicationContext`.

**Aceite:**
- [x] `npm run user:set -w @septo/api -- gabriel` cria o usuário; segunda execução com outra senha atualiza o mesmo registro (continua 1 linha em `users`) e sobe `tokenVersion`
- [x] Senhas diferentes nas duas digitações (TTY), ou fora de 12–128 caracteres, ou username fora de `[A-Za-z0-9._-]{1,50}`, abortam com mensagem clara e exit code ≠ 0, sem tocar no banco
- [x] Senha nunca aparece em log nem em saída; `displayName` inicial = username na criação (no reset, o `displayName` editado é mantido)
- [x] O build gera `dist/cli/set-user.js`, o caminho usado no `docker exec` de produção
- [x] O script `user:set` faz `nest build` e roda `node dist/cli/set-user.js` (o `AppModule` usa decorators, que o type stripping do Node não executa, então não dá para rodar o `.ts` direto)

**Verificação:**
- [x] `npm run test -w @septo/api` (unit do caso de uso com fakes; integração: executa o CLI com `stdin` e confere criar → resetar → hash trocado → `tokenVersion` incrementado)
- [x] Manual: `printf 'senha-de-teste-123\n' | npm run user:set -w @septo/api -- gabriel` e conferir a linha no Postgres

**Dependências:** T3
**Arquivos:** `apps/api/src/modules/identity/application/set-user.use-case.ts` (+ spec), `apps/api/src/cli/set-user.ts`, `apps/api/package.json` (script `user:set`), `apps/api/test/set-user.cli.spec.ts`
**Tamanho:** M

---

### Checkpoint A: usuário existe

- [x] `npm run user:set -w @septo/api -- gabriel` cria e, na segunda execução, reseta
- [x] `lint`, `check-types`, `test` passam; `grep` de camadas limpo
- [ ] Revisão com você antes de seguir

---

## Fase 2: sessão e API protegida

### T5: Token service (JWT), helper do cookie de sessão e `DomainError` `unauthenticated` / `rate_limited`

**Descrição:** `JoseTokenService` emite e verifica JWT HS256 com claims `sub`, `ver`, `iat`, `exp` (30 dias) usando `JWT_SECRET`. `session-cookie.ts` centraliza escrever o cookie (`septo_session`, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`), expirá-lo e ler o cookie pelo nome do header, sem `cookie-parser`. `DomainError` ganha os `kind`s `unauthenticated` → 401 e `rate_limited` → 429 com `retryAfterSeconds` que o filtro converte em `Retry-After`. Nascem aqui os erros `UNAUTHENTICATED` e `INVALID_CREDENTIALS` (`unauthenticated`) e `TOO_MANY_ATTEMPTS` (`rate_limited`).

**Aceite:**
- [x] Token: emitir, verificar, expirado, assinatura inválida, `alg` diferente de HS256 (inclusive `none`) e claims faltando → todos rejeitados; `verify` devolve `{ userId, version, issuedAt }`
- [x] Relógio injetável no token service (para testar expiração e os 15 dias da renovação sem esperar)
- [x] `readSessionCookie` lê o valor certo com vários cookies, com espaços e com valor URL-encoded, e devolve `undefined` quando ausente
- [x] `ApiExceptionFilter` mapeia `unauthenticated` → 401 e `rate_limited` → 429 + header `Retry-After`; `errors.spec.ts` cobre os dois
- [x] Erros `UnauthenticatedError` (`UNAUTHENTICATED`), `InvalidCredentialsError` (`INVALID_CREDENTIALS`) e `TooManyAttemptsError` (`TOO_MANY_ATTEMPTS`, com `retryAfterSeconds`) em `domain/errors.ts`

**Verificação:**
- [x] `npm run test -w @septo/api` (unit do token service e do helper; `errors.spec.ts` estendido)

**Dependências:** T2
**Arquivos:** `apps/api/src/modules/identity/infrastructure/jose-token-service.ts` (+ spec), `apps/api/src/modules/identity/presentation/session-cookie.ts` (+ spec), `apps/api/src/shared/domain-error.ts`, `apps/api/src/shared/http/api-exception.filter.ts`, `apps/api/test/errors.spec.ts`
**Tamanho:** M

---

### T6: `AuthGuard` global, `@Public()`, `@CurrentUser()` e `GET /api/me`

**Descrição:** `AuthenticateUseCase` valida o token (assinatura, expiração) e compara `ver` com `tokenVersion` do usuário no banco (uma consulta por request). O `AuthGuard` é registrado como `APP_GUARD`; `@Public()` o dispensa; `@CurrentUser()` injeta `{ id }`. Se o token tem mais de 15 dias, o guard emite um cookie novo na resposta (renovação deslizante). `GET /api/me` devolve `Me` (schema da spec). `HealthController` fica `@Public()`.

**Aceite:**
- [x] Sem cookie, com token adulterado, expirado, de versão antiga ou de usuário inexistente: `401 { code: "UNAUTHENTICATED" }`, sem diferenciar o motivo
- [x] `GET /api/health`, `/api/docs` e `/api/openapi.json` respondem `200` sem cookie
- [x] Token com > 15 dias e < 30 recebe `Set-Cookie` novo (mesmas flags, `Max-Age` de 30 dias); token com < 15 dias não recebe; token com > 30 dias → `401`
- [x] `Me` sem `passwordHash` nem `tokenVersion` (o schema não tem esses campos e o teste confere o corpo inteiro)
- [x] Rota sem `@Public()` nasce protegida (teste com controller de teste, no padrão do `errors.spec.ts`)

**Verificação:**
- [x] `npm run test -w @septo/api` (unit do `AuthenticateUseCase` com fakes; integração com usuário e tokens montados pelo `TokenService` + repositório reais, relógio falso na renovação)
- [x] `npm run codegen` e `openapi.json` commitado (`meGet`); teste de contrato verde

**Dependências:** T3, T5
**Arquivos:** `apps/api/src/modules/identity/application/{authenticate,get-me}.use-case.ts` (+ specs), `apps/api/src/modules/identity/presentation/{auth.guard,public.decorator,current-user.decorator,me.controller,me.schemas}.ts`, `apps/api/src/modules/health/presentation/health.controller.ts`, `apps/api/test/auth-guard.spec.ts`, `apps/api/openapi.json`
**Tamanho:** L (o núcleo do módulo; se passar de um dia, separar `GET /me` numa tarefa própria)

---

### T7: Limite de tentativas de login (porta + implementação em memória)

**Descrição:** `LoginAttempts` (porta) e `InMemoryLoginAttempts`: por IP, 5 falhas em 15 min bloqueiam; login bem-sucedido zera o contador; a implementação diz quantos segundos faltam para liberar. Relógio injetável. Marcado com `// ponytail:` (em memória, zera ao reiniciar, não cobre ataque distribuído).

**Aceite:**
- [x] A 5ª falha ainda permite tentar; a 6ª tentativa (após 5 falhas) já é bloqueada e informa `retryAfterSeconds` > 0
- [x] Falhas antigas (> 15 min) saem da janela; sucesso zera; IPs diferentes têm contadores independentes
- [x] Sem crescimento ilimitado: entradas expiradas são descartadas

**Verificação:**
- [x] `npm run test -w @septo/api` (unit com relógio falso: limite, janela deslizante, reset, IPs independentes, limpeza)

**Dependências:** T2
**Arquivos:** `apps/api/src/modules/identity/infrastructure/in-memory-login-attempts.ts` (+ spec)
**Tamanho:** S

---

### T8: `POST /api/auth/login` e `POST /api/auth/logout`

**Descrição:** `LoginUseCase`: checa o limite por IP; busca o usuário; verifica a senha (para username inexistente roda o argon2 contra um hash fixo, mesmo tempo e mesma resposta); em sucesso zera o contador, registra `lastLoginAt`/`lastLoginIp` e emite o token. O controller escreve o cookie e devolve `Me`. Logout apaga o cookie (`204`). Ambos `@Public()` com a justificativa em comentário. `trust proxy = 1` no Express via `configureApp`.

**Aceite:**
- [x] Login correto: `200 Me` + `Set-Cookie: septo_session=…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`; `lastLoginAt`/`lastLoginIp` gravados
- [x] Senha errada e usuário inexistente: `401 INVALID_CREDENTIALS`, corpo e mensagem idênticos
- [x] 6ª tentativa errada do mesmo IP em 15 min: `429 TOO_MANY_ATTEMPTS` + `Retry-After`; após login bem-sucedido, o contador zera
- [x] Com `X-Forwarded-For` e `trust proxy = 1`, o IP do cliente (não o do proxy) vai para o limite e para `lastLoginIp`
- [x] Body sem `username`/`password` ou fora do JSON → `400 VALIDATION_ERROR`; logout sem cookie também responde `204`
- [x] Senha e hash nunca aparecem em log nem em resposta de erro

**Verificação:**
- [x] `npm run test -w @septo/api` (unit do `LoginUseCase` com fakes, incluindo a verificação argon2 contra hash fixo quando o usuário não existe; integração: fluxo completo, flags do cookie, 401 idêntico, 429, `X-Forwarded-For`)
- [x] `npm run codegen` (`authLogin`, `authLogout`); teste de contrato verde
- [x] Manual: `curl -i -X POST localhost:3333/api/auth/login -H 'content-type: application/json' -d '{...}'` e depois `curl -b` em `/api/me`

**Dependências:** T4, T6, T7
**Arquivos:** `apps/api/src/modules/identity/application/login.use-case.ts` (+ spec), `apps/api/src/modules/identity/presentation/{auth.controller,auth.schemas}.ts`, `apps/api/src/app.ts` (`trust proxy`), `apps/api/test/auth-login.spec.ts`, `apps/api/openapi.json`
**Tamanho:** L (5 arquivos de código + testes; o limite é a segurança do fluxo, então não fatiar mais)

---

### Checkpoint B: API autenticada ponta a ponta

- [x] `curl`: login → cookie → `GET /api/me` 200; sem cookie 401; 6ª falha 429 com `Retry-After`
- [x] `/api/health` e `/api/docs` seguem `200` sem cookie
- [x] Success Criteria 1, 2, 3, 4 e 5 da spec verificados
- [ ] Revisão com você antes de seguir (pedir também um `security-auditor` sobre T5–T8, já que é o caminho crítico de segurança)

---

## Fase 3: perfil e revogação (API)

### T9: `PATCH /api/me`

**Descrição:** `UpdateProfileUseCase` altera o `displayName` do usuário logado (1–50 caracteres, sem espaços nas pontas; a validação de tamanho no schema zod e a regra no domínio).

**Aceite:**
- [x] `200 Me` com o nome novo; nome vazio, só espaços ou > 50 → `400 VALIDATION_ERROR`; sem sessão → `401`
- [x] Espaços nas pontas são rejeitados (não "consertados" em silêncio), conforme a spec
- [x] Outros campos do corpo (`username`, `tokenVersion`) são ignorados ou rejeitados, nunca gravados

**Verificação:**
- [x] `npm run test -w @septo/api` (unit com fakes; integração: sucesso, inválido, sem sessão)
- [x] `npm run codegen` (`meUpdate`); teste de contrato verde

**Dependências:** T6
**Arquivos:** `apps/api/src/modules/identity/application/update-profile.use-case.ts` (+ spec), `apps/api/src/modules/identity/presentation/{me.controller,me.schemas}.ts`, `apps/api/test/me-profile.spec.ts`, `apps/api/openapi.json`
**Tamanho:** S

---

### T10: `PUT /api/me/password`

**Descrição:** `ChangePasswordUseCase`: exige a senha atual, valida a nova (12–128), grava o hash novo, incrementa `tokenVersion` e o controller reemite o cookie da sessão atual com a versão nova, o que derruba os outros dispositivos e mantém este.

**Aceite:**
- [x] `204` + `Set-Cookie` novo; o token antigo (de outro "dispositivo") passa a responder `401` e o cookie reemitido continua válido
- [x] Senha atual errada → `422 INVALID_CURRENT_PASSWORD` (senha não é alterada, `tokenVersion` não muda); senha nova fora de 12–128 → `400`/`422` conforme o schema; sem sessão → `401`
- [x] A verificação da senha atual usa o mesmo hasher e não vaza o hash em erro nem em log
- [x] Login com a senha antiga passa a falhar e com a nova funciona

**Verificação:**
- [x] `npm run test -w @septo/api` (unit com fakes; integração: dois tokens, troca por um, o outro cai)
- [x] `npm run codegen` (`meChangePassword`); teste de contrato verde

**Dependências:** T6, T8 (login para provar a senha nova)
**Arquivos:** `apps/api/src/modules/identity/application/change-password.use-case.ts` (+ spec), `apps/api/src/modules/identity/presentation/{me.controller,me.schemas}.ts`, `apps/api/test/me-password.spec.ts`, `apps/api/openapi.json`
**Tamanho:** M

---

### T11: `DELETE /api/me/sessions`

**Descrição:** `RevokeSessionsUseCase` incrementa `tokenVersion`; o controller responde `204` e expira o cookie atual ("Sair de todos" também desloga este navegador).

**Aceite:**
- [x] `204` + cookie expirado; todos os tokens emitidos antes respondem `401`; um novo login depois funciona
- [x] Sem sessão → `401`

**Verificação:**
- [x] `npm run test -w @septo/api` (unit com fakes; integração com dois tokens)
- [x] `npm run codegen` (`meRevokeSessions`); teste de contrato verde

**Dependências:** T6
**Arquivos:** `apps/api/src/modules/identity/application/revoke-sessions.use-case.ts` (+ spec), `apps/api/src/modules/identity/presentation/me.controller.ts`, `apps/api/test/me-sessions.spec.ts`, `apps/api/openapi.json`
**Tamanho:** S

---

## Fase 4: web

### T12: Repassar `Set-Cookie` da API no SSR e validador de `?redirect=` ⚠️ risco alto

**Descrição:** Hoje o mutator repassa só o `cookie` do navegador para a API. Passa a devolver também os `Set-Cookie` da resposta da API para a resposta do SSR (`setResponseHeader`/equivalente do TanStack Start), para a renovação deslizante funcionar numa navegação direta. Junto, `redirect.ts` no domínio do web: só aceita path interno (começa com `/` e não com `//`, sem `\`, sem esquema); qualquer outra coisa cai em `/notes`.

**Aceite:**
- [ ] Numa requisição SSR com cookie de token > 15 dias, a resposta HTML do web traz `Set-Cookie: septo_session=…` renovado (mesmas flags), e o cookie do visitante não é duplicado nem perdido
- [ ] No navegador (cliente), o mutator continua sem mexer em cookies
- [ ] `parseRedirect("/notes")` → `/notes`; `//evil.com`, `https://evil.com`, `/\evil.com`, `javascript:alert(1)`, vazio e `undefined` → `/notes`; path com query (`/notes?x=1`) preservado

**Verificação:**
- [ ] `npm run test -w @septo/web` (unit exaustivo do `redirect.ts`, escrito primeiro)
- [ ] Manual: emitir token antigo com o `TokenService` (relógio no passado) e `curl -i --cookie 'septo_session=…' http://localhost:5173/notes` mostra o `Set-Cookie` no HTML; anotar o resultado no commit

**Dependências:** T6 (o guard que renova); pode rodar em paralelo com T9–T11
**Arquivos:** `apps/web/src/shared/api/http-client.ts`, `apps/web/src/features/identity/domain/redirect.ts`, `apps/web/src/features/identity/domain/redirect.spec.ts`
**Tamanho:** S (o risco está no comportamento do SSR, não no tamanho)

---

### T13: Mover shell e rotas para o layout `_app` (refactor, sem mudança de comportamento)

**Descrição:** Rota de layout sem path `routes/_app.tsx` com o shell (`SidebarProvider`, `AppSidebar`, `AppHeader`, `Outlet`); `notes`, `dev-tools`, `settings` (e o redirect de `/`) passam para `routes/_app/`. O `__root.tsx` fica só com documento, `head`, script de preferências, `notFound` e o marcador `data-hydrated`. A URL de cada página não muda. O `/login` (T15) ficará fora do shell.

**Aceite:**
- [ ] Todas as URLs atuais funcionam igual (`/`, `/notes`, `/dev-tools`, `/settings`); páginas renderizam dentro do shell
- [ ] `routeTree.gen.ts` regenerado e links tipados (`to="/notes"`) seguem compilando
- [ ] Nenhuma mudança visual; a suíte e2e existente (shell, configurações, mobile 375 px) passa sem edição
- [ ] O `loader` do health (`ApiStatus`) continua alimentando o shell sem quebrar quando a API cai (prefetch, não ensure)

**Verificação:**
- [ ] `npm run check-types -w @septo/web` e `npm run test -w @septo/web`
- [ ] `npm run test:e2e` (suítes existentes intactas)

**Dependências:** T12
**Arquivos:** `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/_app.tsx`, `apps/web/src/routes/_app/{notes,dev-tools,settings,index}.tsx`, `apps/web/src/routeTree.gen.ts` (gerado)
**Tamanho:** M

---

### T14: E2E autenticado: banco `septo_test`, usuário de teste e `storageState`

**Descrição:** O Playwright passa a subir API e web com `DATABASE_URL` de `septo_test` e `reuseExistingServer: false`. Um `global-setup` aplica as migrations no banco de teste, cria o usuário de teste pelo mesmo CLI (`user:set`, via `stdin`) e faz `POST /api/auth/login` para gravar `storageState`, que todas as suítes usam. Assim, quando o guard do web ligar (T15), as suítes existentes continuam verdes sem UI de login.

**Aceite:**
- [ ] `npm run test:e2e` roda contra `septo_test`; o banco `septo` (dev) não é tocado e o usuário de dev não é sobrescrito
- [ ] O `storageState` contém o cookie `septo_session`; o cookie `Secure` funciona em `http://localhost` (tanto no navegador do Playwright quanto no `request` fixture) — se não funcionar, parar e trazer o plano B da spec/plano para decisão
- [ ] Credenciais de teste em constantes do e2e (não em `.env` nem no README com valor real); README documenta que as portas 5173/3333 precisam estar livres
- [ ] Suíte existente verde, sem edição nos specs (`test.use({ storageState })` no config)

**Verificação:**
- [ ] `npm run test:e2e` (toda a suíte atual, autenticada) e uma segunda execução seguida, para provar idempotência do setup
- [ ] Conferir no Postgres: `septo.users` sem linhas novas, `septo_test.users` com 1

**Dependências:** T8, T13
**Arquivos:** `apps/web/playwright.config.ts`, `apps/web/e2e/global-setup.ts`, `apps/web/e2e/constants.ts`, `.gitignore` (`e2e/.auth/`), `README.md` (trecho do e2e)
**Tamanho:** M

---

### T15: Tela `/login` e guard do web

**Descrição:** `routes/login.tsx` (fora do shell) com `LoginForm` (username + senha, validação com o schema gerado pelo Orval, mensagem "Usuário ou senha inválidos", e no `429` o tempo de espera lido do `Retry-After`). O `beforeLoad` de `_app` faz `ensureQueryData(getMeQueryOptions())` e, no `401`, redireciona para `/login?redirect=<página>`. `/login` com sessão válida redireciona para `/notes`. Depois do login, navega para `parseRedirect(search.redirect)`. O SSR renderiza sem flash de conteúdo deslogado.

**Aceite:**
- [ ] Sem sessão, abrir `/notes` (SSR e navegação direta) responde redirecionamento para `/login?redirect=/notes`; o login volta para `/notes`; `?redirect=//evil.com` é ignorado e vai para `/notes`
- [ ] Credencial errada mostra "Usuário ou senha inválidos" (uma mensagem só para os dois casos); `429` mostra quanto esperar
- [ ] `/login` com sessão válida → `/notes`; a página de login não mostra sidebar nem header do shell
- [ ] Nenhum conteúdo do shell aparece no HTML de uma requisição SSR sem cookie
- [ ] Formulário acessível: labels, `autocomplete="username"` / `current-password`, foco no erro, botão desabilitado enquanto envia; UI em PT-BR

**Verificação:**
- [ ] `npm run check-types` e `npm run test -w @septo/web`
- [ ] e2e novo `e2e/auth.spec.ts` (sem `storageState`): redireciona e volta; credencial errada; `//evil.com` ignorado; `/login` logado vai para `/notes`; SSR sem sessão não contém o shell (`request.get` com `maxRedirects: 0`)
- [ ] `npm run test:e2e` completo

**Dependências:** T14
**Arquivos:** `apps/web/src/routes/login.tsx`, `apps/web/src/routes/_app.tsx`, `apps/web/src/features/identity/components/login-form.tsx`, `apps/web/e2e/auth.spec.ts`, `apps/web/src/routeTree.gen.ts` (gerado)
**Tamanho:** M

---

### T16: Menu do usuário (Sair) e tratamento de `401` no cliente

**Descrição:** `UserMenu` no shell mostra o nome de exibição (lido de `/api/me`) e "Sair"; sair chama `authLogout`, limpa o cache do TanStack Query e navega para `/login`. Interceptor do axios **no navegador**: `401` fora de `/login` limpa o cache e navega para `/login?redirect=<página atual>` (sessão que expira no meio do uso).

**Aceite:**
- [ ] O menu mostra o `displayName`; em 375 px cabe no header/drawer sem scroll horizontal
- [ ] "Sair" encerra a sessão deste navegador e leva a `/login`; voltar com o botão do navegador não mostra conteúdo protegido
- [ ] Um `401` em qualquer chamada do cliente (cookie apagado por fora) leva a `/login?redirect=…` sem loop; `401` da própria chamada de login não redireciona
- [ ] O interceptor não roda no SSR

**Verificação:**
- [ ] `npm run check-types` e `npm run test -w @septo/web` (unit da regra do interceptor: quando redireciona e quando não)
- [ ] e2e: sair e cair em `/login`; apagar o cookie no meio do uso e disparar uma navegação leva a `/login?redirect=`
- [ ] Manual: 375 px

**Dependências:** T15
**Arquivos:** `apps/web/src/features/identity/components/user-menu.tsx`, `apps/web/src/shared/layout/{app-header,app-sidebar}.tsx` (onde encaixar), `apps/web/src/shared/api/http-client.ts`, `apps/web/e2e/auth.spec.ts`
**Tamanho:** M

---

### T17: Configurações → Conta: nome de exibição e último login

**Descrição:** Nova seção "Conta" acima de "Aparência" em `/settings`, com `AccountSettings`: formulário de nome de exibição (`PATCH /me`, validação do schema gerado) e leitura do último login (data formatada em PT-BR e IP; "Nunca" se `null`). O nome atualizado reflete no menu do usuário sem recarregar.

**Aceite:**
- [ ] Editar o nome (1–50 caracteres, sem espaços nas pontas) salva, mostra confirmação e atualiza o menu do usuário na hora; erros de validação aparecem no campo
- [ ] Mostra `lastLoginAt` e `lastLoginIp` como vêm de `Me` (data formatada em PT-BR e IP; "Nunca" se `null`) — ver Open Questions do plano sobre o "último login" ser o da sessão atual
- [ ] Sem regressão nas linhas de tema e acento

**Verificação:**
- [ ] `npm run check-types` e `npm run test -w @septo/web`
- [ ] e2e novo `e2e/account.spec.ts`: editar o nome de exibição e ver no menu; recarregar e persistir

**Dependências:** T16, T9
**Arquivos:** `apps/web/src/features/identity/components/account-settings.tsx`, `apps/web/src/routes/_app/settings.tsx`, `apps/web/e2e/account.spec.ts`
**Tamanho:** M

---

### T18: Configurações → Conta: trocar senha e sair de todos os dispositivos

**Descrição:** Duas ações na seção Conta: formulário de troca de senha (senha atual, nova, confirmação; 12–128 caracteres) com `PUT /me/password`, e "Sair de todos os dispositivos" com confirmação, `DELETE /me/sessions`, limpeza do cache e navegação para `/login`. A troca de senha mantém a sessão atual (cookie reemitido).

**Aceite:**
- [ ] Senha atual errada mostra o erro no campo (`INVALID_CURRENT_PASSWORD`); nova fora de 12–128 ou confirmação diferente bloqueia no formulário; sucesso limpa os campos, confirma e mantém o usuário logado
- [ ] Depois de trocar a senha, outra sessão (contexto de navegador separado) cai no próximo request; a atual segue funcionando
- [ ] "Sair de todos" pede confirmação, derruba todas as sessões, inclusive esta, e leva a `/login`
- [ ] Campos com `autocomplete="current-password"` / `new-password`; nada de senha em `localStorage` nem na URL

**Verificação:**
- [ ] `npm run check-types` e `npm run test -w @septo/web`
- [ ] e2e em `account.spec.ts`: trocar a senha (e restaurar a original ao final, para não quebrar as demais suítes) e checar a segunda sessão; "Sair de todos" leva a `/login` e o `storageState` antigo deixa de valer (rodar isolado, sem afetar o `storageState` compartilhado — usar um usuário/contexto próprio ou logar de novo no teste)
- [ ] Manual: 375 px

**Dependências:** T17, T10, T11
**Arquivos:** `apps/web/src/features/identity/components/account-settings.tsx`, `apps/web/src/features/identity/components/change-password-form.tsx`, `apps/web/e2e/account.spec.ts`
**Tamanho:** M

---

### Checkpoint C: fluxo completo no navegador

- [ ] `/notes` sem sessão → `/login?redirect=/notes` → login → `/notes`; `?redirect=//evil.com` ignorado
- [ ] SSR de página protegida sem flash de conteúdo deslogado
- [ ] `test:e2e` passa (suítes existentes autenticadas + novas); rodar 5 vezes seguidas para provar estabilidade
- [ ] Revisão visual com você (desktop e 375 px)

---

## Fase 5: fechamento

### T19: `.env.example`, README, CLAUDE.md, CAPABILITY-MAP, imagem Docker com o CLI

**Descrição:** Fechar o módulo: `JWT_SECRET` documentado (obrigatório em produção, ≥ 32 caracteres, como gerar) no `.env.example` e no compose de produção/README; README com login, CLI `user:set` (dev e `docker exec`) e o aviso do e2e; CLAUDE.md com as armadilhas novas (guard global, `@Public()`, `trust proxy`, cookie no SSR, e2e em `septo_test`); CAPABILITY-MAP com `identity` ✅ e a spec com status aprovado/implementado. Validar `docker exec … node dist/cli/set-user.js` dentro da imagem `node:24-alpine`.

**Aceite:**
- [ ] Clone limpo: `npm install && cp .env.example .env && docker compose up -d && npm run user:set -w @septo/api -- <user> && npm run dev` → login funciona em `http://localhost:5173` e em `https://localhost`
- [ ] A imagem `septo-api` sobe com `NODE_ENV=production` + `JWT_SECRET` válido, falha o boot sem ele, e `docker exec -it septo-api node dist/cli/set-user.js <user>` cria/reseta o usuário
- [ ] Todos os Success Criteria da spec verificados e marcados aqui; `openapi.json` atualizado; ≥ 90% de linhas em `domain/` e `application/` do identity (ver Open Questions do plano sobre como medir)
- [ ] `lint`, `check-types`, `test` e `test:e2e` passam; segunda execução de `npm run build` é cache hit

**Verificação:**
- [ ] `docker build` da API e do web a partir do clone limpo; teste do CLI dentro do container
- [ ] `grep -rn "JWT_SECRET" --include=*.md --include=.env.example .` mostra a documentação, e `git grep` não acha nenhum valor real de segredo

**Dependências:** T18
**Arquivos:** `.env.example`, `README.md`, `CLAUDE.md`, `CAPABILITY-MAP.md`, `specs/SPEC-identity.md` (status), `tasks/identity/{plan,todo}.md`
**Tamanho:** M (só documentação e configuração)

---

### Checkpoint final

- [ ] Todos os Success Criteria da spec verificados
- [ ] Clone limpo → fluxo completo funciona
- [ ] Revisão final com você (`/agent-skills:review` e `security-auditor` antes do PR)
