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
- Toda tarefa termina com `npm run lint`, `npm run check-types` e `npm run test` passando (infra no ar: `docker compose up -d`).
- UI em PT-BR; código, commits e identificadores em inglês.

## Armadilhas conhecidas

- **API em TypeScript 6** (Nest CLI precisa da API do compilador, ausente no TS 7.0); web e pacotes em TS 7.
- **API é ESM**: imports relativos terminam em `.js`.
- **Contrato**: schemas zod em `presentation` → `npm run codegen` → commitar `apps/api/openapi.json`. Nunca editar `apps/web/src/shared/api/generated/`.
- **operationId** = `<controller><Método>` (`HealthController.check` → `healthCheck` → `useHealthCheck`).
- **CLI do shadcn quebra nesta máquina** (ponto no caminho do usuário; já instalou o pacote npm errado `cn`). Baixe componentes do registry `base-nova` aplicando as transformações descritas na spec do foundation.
- **Texto em acento** usa `text-brand-text`, nunca `text-primary`.
- **Compose = só infra** (Postgres + Caddy). API e web rodam no host em dev e como imagens avulsas na rede `septo` em produção; o Caddy aponta via `API_UPSTREAM`/`WEB_UPSTREAM`.
- **Postgres do container na porta 5433**, só em `127.0.0.1` (há um Postgres local na 5432).
- **Vite escuta em `127.0.0.1`** (não `localhost`/`::1`) para o Caddy alcançá-lo via `host.docker.internal`.
- **Identity**: `AuthGuard` global — rota nova na API nasce protegida; `@Public()` só em `health` e `auth/login|logout` (justifique no PR). Os docs (Scalar/`openapi.json`) são `app.use` e ficam fora do guard.
- **Sessão**: JWT HS256 no cookie `septo_session` (`HttpOnly; Secure; SameSite=Lax`), 30 dias deslizantes; revogar = incrementar `users.tokenVersion`. Mutação exige corpo JSON (415 caso contrário) — é a defesa de CSRF junto com o `SameSite`. `trust proxy = 1`: só o Caddy fica na frente da API.
- **Login**: o limite por cliente conta a tentativa *antes* do argon2 e zera no sucesso; IPv6 conta por /64. Não mude sem perguntar (é regra de "Perguntar antes" da spec).
- **Node ≥ 24.7** por causa do `crypto.argon2`. O usuário é criado por `npm run user:set -w @septo/api -- <usuário>` (build + CLI; no container, `node dist/cli/set-user.js`).
- **Testes de integração da API rodam em série** (`fileParallelism: false`) no banco `septo_test`, migrado pelo `globalSetup`.
- **e2e** sobe a própria API (:3433) e o próprio web (:5273) em `septo_test`, com o usuário `e2e`, e nunca reaproveita os servidores de dev. Suítes que mudam senha/sessão/nome são `*.destructive.spec.ts` e rodam sozinhas, depois das demais.
- **Cookie no SSR**: o mutator repassa o `cookie` do navegador para a API e devolve os `Set-Cookie` da API na resposta da página (renovação deslizante). O 401 no navegador vai para `/login` (`features/identity/domain/unauthorized.ts` diz quando).
- **e2e**: espere `body[data-hydrated]` (helper `gotoHydrated`) antes de interagir.
- **Notas guardam markdown** (coluna `body`). A ponte com o editor é `apps/web/src/features/notes/domain/markdown.ts` (`prosemirror-markdown` contra o schema do Tiptap, nomes de nó em camelCase). Mexer nela exige atualizar `markdown.spec.ts` (round-trip). O que sai do conjunto de formatação vira texto sem perda; parágrafo vazio, lista frouxa e título de link são normalizados (está no spec).
- **`searchText` é derivado dentro da entidade `Note`** (`create`/`edit`; o `restore` recalcula): nada de fora o define. A query chega normalizada ao repositório, que **escapa `%`, `_` e `\`** — o `contains` do Prisma vira `LIKE` sem escapar. O `id` é `uuid` no Postgres: id de outro formato é `404` (o repositório devolve `null`), nunca `500`.
- **`GET /tags` é o `TagsController`**, separado do de notas, para não disputar rota com `GET /notes/:id`.
- **O editor é um chunk à parte**: `routes/_app/notes/$noteId.tsx` o importa com `lazy` dentro de `ClientOnly`. Nada que a lista usa pode importar Tiptap nem `markdown.ts`, ou o bundle (~175 KB gz) volta para `/notes`. O e2e confere.
- **O editor começa do cache do Query, não do `useLoaderData`**: o router devolve o dado do loader em cache ao revisitar uma nota, e o próximo autosave sobrescreveria o que acabou de ser digitado. O editor mantém o cache do detalhe atualizado a cada edição.
- **Autosave** (`domain/autosave.ts`): salva em série, com debounce de 800 ms, e só invalida a lista ao concluir. `attach()`/`detach()` no efeito, não um `dispose` definitivo: o React pode reexecutar efeitos sem recriar o estado, e isso silenciava o indicador. `/notes/new` é um rascunho local; o POST vem no primeiro save com conteúdo e a rota troca a URL sem remontar o editor.
- **Foco no editor é síncrono quando vem de uma tecla**: `commands.focus()`/`chain().focus()` do Tiptap adiam (rAF) e as teclas seguintes caem no campo anterior. Use `editor.view.focus()` e, no Enter de um campo, `preventDefault()` no `keydown`, senão o resto do Enter vaza para o editor e substitui a seleção.
- **Link com aparência de botão = `buttonVariants` no `<Link>`**, não `<Button render={<Link/>}>`: com `nativeButton={false}` o Base UI põe `role="button"` no `<a>`. Um `<input list>` (datalist) é `combobox`, não `textbox`.
- **Datas**: `LocalTime` renderiza em UTC no servidor e corrige depois de hidratar (evita mismatch de hidratação). `<input type="datetime-local">` é hora local sem fuso: a conversão de/para ISO está em `domain/remind-at.ts`.
- **e2e do editor**: `End` rola a página no macOS (não move o caret); clique na área vazia abaixo do texto para ir ao fim. Depois de colapsar a seleção com as setas, espere o `selectionchange` do ProseMirror antes do Enter. As suítes de notas rodam em série e limpam as notas pela API (`resetNotes`); os testes da API dividem o `septo_test` com o e2e e apagam o usuário `e2e` (o `global-setup` o recria).
