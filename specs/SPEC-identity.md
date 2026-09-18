# Spec: identity

> Módulo `identity` do [CAPABILITY-MAP](../CAPABILITY-MAP.md). Status: **rascunho**, aguardando aprovação.
> Herda as convenções globais de [SPEC-foundation](SPEC-foundation.md): camadas, contrato zod → OpenAPI → Orval, estilo, testes e limites. Aqui fica só o que é específico do módulo.

## Objetivo

Proteger o septo atrás de um login. O app roda numa VPS exposta na internet e tem **um único usuário** (eu). Sem login, qualquer pessoa com a URL lê minhas notas.

Sucesso = abro `https://<domínio>`, caio em `/login`, entro com username e senha e fico logado por 30 dias enquanto uso o app. Consigo trocar a senha, editar meu nome de exibição, ver de onde foi o último login e derrubar todas as sessões de uma vez. Todas as rotas da API, exceto as públicas, respondem `401` sem sessão válida.

### Histórias

1. Sem sessão, qualquer página do app redireciona para `/login?redirect=<página>`; depois do login volto para onde estava.
2. Login com username + senha. Credencial errada mostra "Usuário ou senha inválidos", sem dizer qual dos dois errou.
3. Depois de 5 tentativas erradas em 15 min vindas do mesmo IP, o login responde `429` e a tela informa quanto tempo esperar.
4. A sessão dura 30 dias e é renovada sozinha enquanto uso o app.
5. "Sair" no menu do usuário encerra a sessão deste navegador.
6. Em Configurações → Conta: editar o nome de exibição, trocar a senha, ver o último login (data e IP) e "Sair de todos os dispositivos".
7. Trocar a senha derruba as sessões dos outros dispositivos e mantém a atual.
8. O usuário é criado ou tem a senha resetada por um comando CLI. Não existe cadastro pela UI.

### Fora de escopo (v1)

Cadastro de usuário, multiusuário, recuperação de senha por e-mail (o reset é feito pelo CLI), avatar, trocar o username pela UI, 2FA/TOTP, passkeys, tokens de acesso pessoal para scripts, listar ou revogar sessões individualmente, e preferências (tema e acento) sincronizadas no servidor, que continuam no `localStorage`.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Credencial | **username** + senha (substitui o "e-mail" do mapa) | Não há envio de e-mail; o username só identifica |
| Onde mora o usuário | Tabela `users` no Postgres (substitui "hash em env" do mapa) | Troca de senha, perfil e revogação precisam de estado persistido |
| Quantidade de usuários | No máximo **1**, garantido pelo CLI: se já existe um usuário, o comando o atualiza em vez de criar outro | App pessoal; os outros módulos não precisam de `ownerId` |
| Hash de senha | argon2id do `node:crypto` (`crypto.argon2`, Node ≥ 24.7), parâmetros OWASP (m = 19 MiB, t = 2, p = 1), salvo em formato PHC | Mantém a decisão argon2 do mapa sem dependência nativa |
| Sessão | **JWT** HS256 em cookie `septo_session`: `HttpOnly; Secure; SameSite=Lax; Path=/` | Pedido explícito; o cookie httpOnly fica fora do alcance do JS |
| Claims | `sub` = id do usuário, `ver` = `tokenVersion`, `iat`, `exp` | — |
| Revogação | `users.tokenVersion`: o guard compara `ver` do token com a versão atual (uma consulta por request). Incrementar a versão derruba todos os tokens emitidos | Revogação barata, sem tabela de sessões |
| Expiração | 30 dias, **deslizante**: se o token tem mais de 15 dias, o guard emite um cookie novo na resposta | Uso diário nunca pede login; 30 dias parado pede |
| Logout | Apaga o cookie. "Sair de todos" incrementa `tokenVersion` e também apaga o cookie atual | — |
| Troca de senha | Exige a senha atual; incrementa `tokenVersion` e reemite o cookie da sessão atual | Derruba os outros dispositivos e mantém este |
| Senha | 12 a 128 caracteres, sem outras regras de composição | NIST 800-63B |
| Brute force | Por IP: 5 falhas em 15 min → `429 TOO_MANY_ATTEMPTS` com `Retry-After`. Login bem-sucedido zera o contador. Contador em memória | Uma instância só; reiniciar a API zera, o que é aceitável |
| Enumeração | Username inexistente também roda uma verificação argon2 contra um hash fixo; a resposta é sempre `401 INVALID_CREDENTIALS` | Mesmo tempo de resposta e mesma mensagem nos dois casos |
| IP do cliente | `trust proxy` = 1 no Express (em produção o Caddy é o único salto) | `req.ip` correto para o rate limit e o último login |
| CSRF | `SameSite=Lax` + mesma origem + corpo JSON obrigatório nas mutações | Lax bloqueia POST/PATCH/PUT/DELETE vindos de outro site; não precisa de token CSRF |
| Guard da API | `AuthGuard` global; `@Public()` libera `health`, `auth/login`, `auth/logout` e os docs (Scalar e `openapi.json`) | Seguro por padrão: rota nova nasce protegida |
| Usuário no handler | Decorator `@CurrentUser()` injeta `{ id }` | — |
| Guard do web | Rota de layout sem path (`_app`) com o shell. O `beforeLoad` garante `/api/me` e redireciona para `/login` no `401`. `/login` fica fora do shell | A página de login não mostra sidebar |
| Cookie no SSR | O mutator já repassa o `cookie` do navegador para a API. Passa a repassar também o `Set-Cookie` da API para a resposta do SSR (renovação deslizante numa navegação direta) | Senão a renovação só aconteceria em chamadas feitas pelo navegador |
| 401 no cliente | Interceptor do axios no navegador: `401` fora de `/login` limpa o cache do TanStack Query e navega para `/login?redirect=` | Sessão que expira no meio do uso |
| Último login | `users.lastLoginAt` e `users.lastLoginIp`, atualizados a cada login bem-sucedido | — |

## Contrato da API

Todas sob `/api`. Os erros seguem o padrão `{ code, message }` do foundation.

| Método e rota | Handler (operationId) | Público | Entrada | Sucesso | Erros |
|---|---|---|---|---|---|
| `POST /auth/login` | `authLogin` | sim | `{ username, password }` | `200 Me` + `Set-Cookie` | `401 INVALID_CREDENTIALS`, `429 TOO_MANY_ATTEMPTS` |
| `POST /auth/logout` | `authLogout` | sim | — | `204` + cookie expirado | — |
| `GET /me` | `meGet` | não | — | `200 Me` | `401 UNAUTHENTICATED` |
| `PATCH /me` | `meUpdate` | não | `{ displayName }` (1 a 50 caracteres, sem espaços nas pontas) | `200 Me` | `401` |
| `PUT /me/password` | `meChangePassword` | não | `{ currentPassword, newPassword }` | `204` + cookie reemitido | `401`, `422 INVALID_CURRENT_PASSWORD` |
| `DELETE /me/sessions` | `meRevokeSessions` | não | — | `204` + cookie expirado | `401` |

```ts
// Me (components/schemas/Me)
{ id: string /* uuid */; username: string; displayName: string; lastLoginAt: string | null /* ISO */; lastLoginIp: string | null }
```

`DomainError` ganha dois `kind`s: `unauthenticated` → 401 e `rate_limited` → 429, este com `retryAfterSeconds`, que o filtro converte no header `Retry-After`.

## Modelo de dados

```prisma
model User {
  id           String    @id @default(uuid()) @db.Uuid
  username     String    @unique
  passwordHash String
  displayName  String
  tokenVersion Int       @default(0)
  lastLoginAt  DateTime?
  lastLoginIp  String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@map("users")
}
```

Primeira migration do projeto. `displayName` começa igual ao `username`.

## CLI

```bash
npm run user:set -w @septo/api -- <username>                 # dev: cria o usuário ou reseta a senha
docker exec -it septo-api node dist/cli/set-user.js <username>   # produção
```

Pede a senha duas vezes, sem eco (ou lê de `stdin` quando não é TTY, para os testes). Se não existe usuário, cria. Se existe, troca username e senha e incrementa `tokenVersion`, o que derruba todas as sessões. O comando valida a senha com as mesmas regras da API.

## Variáveis de ambiente (novas)

| Variável | Default dev | Uso |
|---|---|---|
| `JWT_SECRET` | valor fixo de dev, só quando `NODE_ENV !== 'production'` | Assina o JWT. Em produção é obrigatória e precisa ter ≥ 32 caracteres; sem ela, o boot falha |

O default de dev existe para o `codegen` e o CI subirem o `AppModule` sem `.env`, no mesmo padrão do `DATABASE_URL`.

## Estrutura

```
apps/api/src/modules/identity/
  domain/          user.ts, user.repository.ts (porta), password-hasher.ts (porta), token-service.ts (porta),
                   login-attempts.ts (porta), errors.ts
  application/     login, get-me, update-profile, change-password, revoke-sessions, authenticate (usado pelo guard),
                   set-user (usado pelo CLI) — um *.use-case.ts cada
  infrastructure/  user.prisma-repository.ts, argon2-password-hasher.ts, jose-token-service.ts,
                   in-memory-login-attempts.ts
  presentation/    auth.controller.ts, me.controller.ts, *.schemas.ts, auth.guard.ts, public.decorator.ts,
                   current-user.decorator.ts, session-cookie.ts
  identity.module.ts
apps/api/src/cli/set-user.ts

apps/web/src/
  routes/login.tsx
  routes/_app.tsx                  layout com shell + guard (as rotas atuais passam para routes/_app/)
  features/identity/
    domain/redirect.ts             valida o ?redirect= (só paths internos: começa com "/" e não com "//")
    components/                    login-form, user-menu, account-settings (perfil, senha, último login, sair de todos)
```

## Dependências novas (pedem aprovação)

| Pacote | Onde | Motivo |
|---|---|---|
| `jose` 6 | api | Assinar e verificar o JWT. Zero dependências, API baseada em WebCrypto. Escrever HS256 à mão num caminho de segurança não compensa |

Sem `cookie-parser`: o Express 5 escreve cookies com `res.cookie()`, e para ler um cookie pelo nome basta um helper de poucas linhas em `session-cookie.ts`. Sem `@nestjs/throttler`: o limite cobre um endpoint só.

## Testes

| Nível | Cobre |
|---|---|
| Unit | Entidade `User` (troca de senha, `tokenVersion`, perfil); casos de uso com fakes das portas; hasher argon2 real (hash, verificação, PHC inválido); token service (emitir, verificar, expirado, assinatura inválida, `ver`); login attempts com relógio falso; `redirect` do web |
| Integração | Login seta o cookie com as flags certas; `401` sem cookie e com token adulterado, expirado ou de versão antiga; o `/api/health` e os docs seguem públicos; `429` na 6ª falha com `Retry-After`; renovação deslizante; troca de senha invalida outro token e mantém o atual; `DELETE /me/sessions` invalida todos; CLI cria e depois reseta |
| Contrato | `openapi.json` regenerado e commitado (teste existente) |
| E2E | Página protegida redireciona para `/login` e volta após o login; credencial errada mostra erro; sair; editar nome de exibição. As suítes existentes (shell, configurações) rodam autenticadas via `storageState` |

Meta: ≥ 90% de linhas em `domain/` e `application/` do identity, como no foundation.

## Boundaries

- **Sempre:** rota nova na API nasce protegida; `@Public()` exige justificativa no PR. Senha e hash nunca vão para log, resposta ou mensagem de erro. Comparações de segredo em tempo constante.
- **Perguntar antes:** mudar as flags do cookie, a expiração ou os parâmetros do argon2; adicionar mais usuários ou `ownerId` nos outros módulos; mexer no rate limit.
- **Nunca:** guardar o JWT em `localStorage` ou em cookie legível por JS; expor `passwordHash` ou `tokenVersion` na API; usar a mensagem de erro para diferenciar "usuário não existe" de "senha errada".

## Success Criteria

1. Sem cookie, `GET /api/me` responde `401 { code: "UNAUTHENTICATED" }`, e `GET /api/health` e `/api/docs` continuam respondendo `200`.
2. `npm run user:set -w @septo/api -- gabriel` cria o usuário. Rodar de novo com outra senha invalida a senha antiga e todas as sessões.
3. Login correto responde `200 Me` com `Set-Cookie: septo_session=…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`. Login errado responde `401 INVALID_CREDENTIALS`, com a mesma resposta para usuário inexistente e para senha errada.
4. A 6ª tentativa errada do mesmo IP em 15 min responde `429 TOO_MANY_ATTEMPTS` com `Retry-After`.
5. Um token com mais de 15 dias recebe um cookie novo na próxima request autenticada. Um token com mais de 30 dias responde `401`.
6. Depois de `PUT /me/password`, o token antigo de outro dispositivo responde `401` e o cookie reemitido para este continua válido. Depois de `DELETE /me/sessions`, todos respondem `401`.
7. No web, abrir `/notes` sem sessão leva a `/login?redirect=/notes`, e o login leva de volta a `/notes`. `?redirect=//evil.com` é ignorado e vai para `/notes`.
8. `/login` com sessão válida redireciona para `/notes`. O shell mostra o nome de exibição no menu do usuário, com "Sair".
9. Configurações → Conta edita o nome de exibição, troca a senha, mostra o último login e oferece "Sair de todos os dispositivos".
10. O SSR de uma página protegida renderiza sem flash de conteúdo deslogado.
11. `lint`, `check-types`, `test` e `test:e2e` passam. `openapi.json`, `.env.example`, README, CLAUDE.md e CAPABILITY-MAP estão atualizados.

## Riscos

| Risco | Mitigação |
|---|---|
| `crypto.argon2` é recente no Node (24.7) | A imagem é `node:24-alpine` (última 24.x) e o local é o 26. Fixar `engines.node >= 24.7`. Se a API mudar, trocar o adapter por `@node-rs/argon2` sem mexer na porta |
| E2E precisa de um usuário conhecido, e o `user:set` sobrescreveria o usuário de dev | No plano: o e2e roda contra o banco `septo_test`, e um global setup cria o usuário de teste pelo mesmo CLI |
| Cookie `Secure` em `http://localhost:5173` | Chrome e Firefox tratam `localhost` como contexto seguro e aceitam. `https://localhost` via Caddy também funciona |
| Rate limit em memória zera ao reiniciar a API e não cobre um ataque distribuído entre IPs | Aceito para um usuário só: senha ≥ 12 caracteres + argon2. Marcado com `// ponytail:` |
| Uma consulta ao banco por request autenticada (checagem do `tokenVersion`) | Insignificante com um usuário só |

## Open Questions

Nenhuma. Todas as decisões foram fechadas em 2026-09-18 (usuário no banco, `tokenVersion`, 30 dias deslizante, escopo v1 com troca de senha, sair de todos, nome de exibição e último login).
