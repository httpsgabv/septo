# Tarefas: notes

> Plano: [plan.md](plan.md) · Spec: [SPEC-notes](../../specs/SPEC-notes.md)
> Branch: `feat/notes` · um commit por tarefa (Conventional Commits, em inglês).
> Regra geral: toda tarefa termina com `npm run lint`, `npm run check-types` e `npm run test` passando (infra no ar: `docker compose up -d`).
> Só a T7 mexe em rota da API: é ela que roda `npm run codegen` e commita `apps/api/openapi.json`. Todo erro documentado vai com `@ZodResponse(<status>, errorResponse)`.
> Camadas: Prisma só em `infrastructure`; `domain` sem framework; portas são `abstract class`; imports relativos da API terminam em `.js`.
> Nenhuma rota deste módulo leva `@Public()` — o `AuthGuard` global do identity protege tudo.
> UI em PT-BR; código, commits e identificadores em inglês. Texto em acento usa `text-brand-text`.

---

## Fase 1: risco — ponte markdown (web, isolado)

### T1: Dependências do Tiptap + bridge markdown com testes de round-trip ⚠️ risco alto

**Descrição:** Instalar `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` (3.31.3) e `prosemirror-markdown` (1.13.7) no web, e escrever `features/notes/domain/markdown.ts`: `parseMarkdown(md): JSONContent` e `serializeMarkdown(doc): string`, construídos sobre `getSchema(noteExtensions)` do Tiptap. Os mapas de token e de serialização são escritos à mão contra os nomes de nó do Tiptap (`bulletList`, `orderedList`, `listItem`, `codeBlock`, `horizontalRule`, `hardBreak`), **não** copiados dos defaults `snake_case` do `prosemirror-markdown`. O tokenizer do `defaultMarkdownParser` (CommonMark) ganha a regra `strikethrough` para habilitar `~~riscado~~` (sem importar `markdown-it` direto, que não é dependência declarada), e o serializer emite `~~` para a mark `strike`. `noteExtensions` (o StarterKit configurado com o conjunto aprovado: h1–h3, bold, italic, strike, code, codeBlock, bulletList, orderedList, listItem, blockquote, link, horizontalRule, hardBreak, paragraph, text) fica neste arquivo e é a fonte única usada depois pelo editor. **Sem UI nesta tarefa.**

**Aceite:**
- [x] `parseMarkdown` e `serializeMarkdown` exportados de `features/notes/domain/markdown.ts`, puros, sem import de React
- [x] Round-trip fecha (`serialize(parse(md)) === md`) para a tabela de casos: h1/h2/h3, negrito, itálico, riscado, código inline, bloco de código, lista com marcador, lista numerada, lista aninhada de dois níveis, citação, link, linha horizontal, quebra de linha, parágrafos múltiplos, texto com `*`/`_`/`#` que precisam de escape, e documento vazio
- [x] Round-trip inverso (`parse(serialize(doc))`) preserva o documento nos mesmos casos
- [x] Markdown com construção fora do conjunto (tabela GFM, imagem, `- [x]`) tem comportamento **decidido e testado** — preservar como texto ou descartar — documentado no próprio teste
- [x] `noteExtensions` exportado; nenhum nó do schema fica sem regra no serializer (teste percorre `schema.nodes` e `schema.marks` e falha se faltar mapeamento)

**Verificação:**
- [x] `npm run test -w @septo/web` (specs escritos antes da implementação)
- [x] `npm run check-types` e `npm run lint`
- [x] Se o import do StarterKit quebrar no ambiente `node` do Vitest: tentar `getSchema()` sem tocar na view; se não resolver, **parar e pedir aprovação** para a devDependency `jsdom` (fora da tabela da spec)

**Dependências:** nenhuma
**Arquivos:** `apps/web/src/features/notes/domain/markdown.ts`, `apps/web/src/features/notes/domain/markdown.spec.ts`, `apps/web/package.json`, `package-lock.json`
**Tamanho:** L

---

## Fase 2: API

### T2: Model `Note` + migration

**Descrição:** Model `Note` exatamente como na spec (sem `ownerId`, sem índices, `createdAt`/`updatedAt` sem default — o domínio controla) e migration aplicada em `septo` e `septo_test`.

**Aceite:**
- [x] `apps/api/prisma/schema.prisma` com o model `Note` da spec, `@@map("notes")`
- [x] Migration `prisma/migrations/<ts>_create_notes` aplicada nos dois bancos
- [x] `prisma generate` roda e o client tipado expõe `note`

**Verificação:**
- [x] `npm run db:migrate -w @septo/api`; `docker compose down -v && docker compose up -d && npm run test -w @septo/api` (o `globalSetup` aplica as migrations no banco de teste do zero)

**Dependências:** nenhuma
**Arquivos:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`
**Tamanho:** S

---

### T3: Domínio: entidade `Note`, tags, `searchText`, erros e porta

**Descrição:** TS puro, sem framework, com TDD. Entidade `Note` com `create`, `edit` (título, corpo, tags, `remindAt`), `setPinned`, `setArchived`. `edit` atualiza `updatedAt` e recalcula `searchText`; `setPinned`/`setArchived` **não** tocam `updatedAt`. Value object de tags com a normalização da spec (trim, minúsculas, dedupe, espaço → `-`, 1–30 caracteres, padrão `[\p{L}\p{N}._-]+`, máximo 10). `searchText` é derivado (título + corpo, `NFD` sem diacrítico, minúsculas) dentro da entidade. Erros `NOTE_NOT_FOUND` (`kind: 'not_found'`), `NOTE_EMPTY` e `INVALID_TAG` (`kind: 'invalid'`). Porta `NoteRepository` como `abstract class`, incluindo o critério de listagem (`{ query?, tag?, view }`).

**Aceite:**
- [x] `create` rejeita título e corpo vazios (ou só espaços) com `NoteEmptyError`; aceita só título ou só corpo
- [x] `edit` sobe `updatedAt` para o `now` recebido e recalcula `searchText`; `setPinned`/`setArchived` preservam `updatedAt`
- [x] Fixar/arquivar duas vezes é idempotente (não sobrescreve `pinnedAt`/`archivedAt` existente); desfazer volta para `null`
- [x] `remindAt` aceita `Date` e `null` (limpar); não há validação de data no passado
- [x] Tags: `"  Trabalho "`, `"trabalho"` e `"TRABALHO"` colapsam numa só; `"a b"` → `"a-b"`; 11ª tag, tag vazia, tag com 31 caracteres e tag com caractere inválido lançam `InvalidTagError`
- [x] `searchText` de "Anotação" contém "anotacao"; não existe setter público de `searchText` (teste garante que só `create`/`edit` o produzem)
- [x] Nenhum import de Nest, Prisma ou `node:` em `domain/`

**Verificação:**
- [x] `npm run test -w @septo/api` (`note.spec.ts`, `tags.spec.ts`, `search-text.spec.ts`, escritos antes)
- [x] `grep -rn "@nestjs\|generated/prisma\|node:" apps/api/src/modules/notes/domain` sem resultado

**Dependências:** T2
**Arquivos:** `apps/api/src/modules/notes/domain/{note,note.repository,tags,search-text,errors}.ts` (+ specs)
**Tamanho:** M

---

### T4: Casos de uso de escrita

**Descrição:** `CreateNoteUseCase`, `UpdateNoteUseCase`, `GetNoteUseCase`, `SetNotePinnedUseCase`, `SetNoteArchivedUseCase`, `DeleteNoteUseCase`, cada um em seu arquivo com `execute`, testados contra um `FakeNoteRepository` em `modules/notes/testing/fakes.ts` e `now` fixo (padrão `now = () => new Date()` do identity). `UpdateNoteUseCase` aplica patch parcial: campo ausente não muda, `remindAt: null` limpa.

**Aceite:**
- [x] Cada caso de uso tem spec com caminho felizes e `NOTE_NOT_FOUND` quando o id não existe
- [x] `UpdateNoteUseCase` distingue "campo ausente" de `null` e rejeita edição que deixe título e corpo vazios (`NOTE_EMPTY`)
- [x] `SetNotePinned`/`SetNoteArchived` recebem booleano e devolvem a nota atualizada
- [x] `DeleteNoteUseCase` remove e lança `NOTE_NOT_FOUND` para id inexistente
- [x] `FakeNoteRepository` não duplica regra de domínio (só guarda e devolve)

**Verificação:**
- [x] `npm run test -w @septo/api`
- [x] `npm run coverage -w @septo/api` mostra ≥ 90% de linhas em `modules/notes/{domain,application}`

**Dependências:** T3
**Arquivos:** `apps/api/src/modules/notes/application/*.use-case.ts` (+ specs), `apps/api/src/modules/notes/testing/fakes.ts`
**Tamanho:** M

---

### T5: Casos de uso de leitura

**Descrição:** `ListNotesUseCase` (filtros `q`, `tag`, `view` = `active` | `archived` | `reminders`; ordenação: fixadas por `pinnedAt` desc, depois `updatedAt` desc; `reminders` por `remindAt` asc; teto de 200 com `// ponytail:`) e `ListTagsUseCase` (tags distintas de notas não arquivadas, ordem alfabética). Testados com o fake.

**Aceite:**
- [x] `view=active` exclui arquivadas; `view=archived` traz só arquivadas; `view=reminders` traz não arquivadas com `remindAt` não nulo, ordenadas por data
- [x] `q` casa título e corpo, acento- e caixa-insensível (compara contra `searchText`); `q` em branco é ignorado
- [x] `q` e `tag` combinam (interseção)
- [x] Fixadas vêm antes das demais mesmo com `updatedAt` mais antigo
- [x] Teto de 200 aplicado, com o comentário `// ponytail:` da spec
- [x] `ListTagsUseCase` devolve cada tag uma vez, alfabética, ignorando as de notas arquivadas (teste explícito desse comportamento — é o ponto listado em Open Questions do plano)

**Verificação:**
- [x] `npm run test -w @septo/api`

**Dependências:** T3
**Arquivos:** `apps/api/src/modules/notes/application/{list-notes,list-tags}.use-case.ts` (+ specs)
**Tamanho:** M

---

### T6: Repositório Prisma + mapper

**Descrição:** `NotePrismaRepository` implementando a porta, com mapper Prisma ↔ domínio (sem vazar o model). A busca usa `contains` sobre `searchText` com a query normalizada pela mesma função do domínio; o filtro de tag usa `has`. `createdAt`/`updatedAt` vêm da entidade (o model não tem default), então o mapper os passa explicitamente. Cria o `NotesModule` ligando porta → implementação e o registra no `AppModule`.

**Aceite:**
- [x] `findById`, `list(criteria)`, `save` (cria e atualiza), `delete`, `listTags` implementados
- [x] Mapper converte `pinnedAt`/`archivedAt`/`remindAt` `null` ↔ `null` e `tags` array ↔ VO
- [x] Ordenação e teto de 200 acontecem no banco (`orderBy` + `take`), não em memória
- [x] `NotesModule` registrado; DI resolve com o build SWC
- [x] Prisma aparece só em `infrastructure/`

**Verificação:**
- [x] `npm run test -w @septo/api` — integração contra `septo_test` (banco real): criar e reler, `contains` acento-insensível, `has` de tag, ordenação com fixada, `take` de 200, `delete`
- [x] `npm run build -w @septo/api && node apps/api/dist/main.js` sobe sem erro de DI
- [x] `grep -rn "generated/prisma" apps/api/src/modules/notes` só acusa `infrastructure/`

**Dependências:** T4, T5
**Arquivos:** `apps/api/src/modules/notes/infrastructure/{note.prisma-repository,note.mapper}.ts` (+ specs), `apps/api/src/modules/notes/notes.module.ts`, `apps/api/src/app.module.ts`
**Tamanho:** M

---

### T7: HTTP: `NotesController`, `TagsController`, schemas zod e `openapi.json`

**Descrição:** Presentation completa: schemas zod de request/response com `.meta({ id })` para `Note` e `NoteSummary`, mappers domínio → response (incluindo o trecho de 160 caracteres e `pinned`/`archived` booleanos), `NotesController` com as nove rotas e `TagsController` com `GET /tags` (controller separado para não disputar rota com `GET /notes/:id`). Limites de entrada: `title` ≤ 200, `body` ≤ 100.000, `q` ≤ 200, até 10 tags. Roda `codegen` e commita o `openapi.json`.

**Aceite:**
- [x] As dez operações da spec respondem nos status certos, com os `operationId` esperados (`notesList`, `notesCreate`, `notesGet`, `notesUpdate`, `notesPin`, `notesUnpin`, `notesArchive`, `notesUnarchive`, `notesDelete`, `tagsList`)
- [x] `PATCH` com corpo parcial funciona; `remindAt: null` limpa; `remindAt` é `z.iso.datetime()` no contrato
- [x] Erros documentados: `400` (validação), `401`, `404 NOTE_NOT_FOUND`, `422 NOTE_EMPTY`
- [x] `openapi.json` regenerado e commitado; `Note` e `NoteSummary` viram `components/schemas` nomeados
- [x] Nenhum `@Public()` no módulo

**Verificação:**
- [x] `npm run test -w @septo/api` — integração HTTP: CRUD ponta a ponta, `401` em todas as rotas sem cookie, `q` acento-insensível, filtro por tag, `view=archived`/`reminders`, fixada no topo, `GET /tags` distinto e sem arquivadas, `404` depois do delete, `422` no `POST` vazio, `415` em mutação com corpo não-JSON
- [x] `npm run codegen && npm run check-types` — o teste de contrato do `openapi.json` passa
- [x] `/api/docs` lista as dez operações

**Dependências:** T6
**Arquivos:** `apps/api/src/modules/notes/presentation/{notes.controller,tags.controller,notes.schemas}.ts`, `apps/api/test/notes*.spec.ts`, `apps/api/openapi.json`
**Tamanho:** L

---

## Fase 3: web

### T8: Rota `/notes` como layout de duas colunas, lista no SSR e filtros na URL

**Descrição:** `routes/_app/notes.tsx` deixa de ser folha e passa a ser layout: coluna da lista + `Outlet`. `validateSearch` com zod para `q`, `tag` e `view` (`features/notes/domain/search-params.ts`). O loader chama `ensureQueryData(getNotesListQueryOptions(...))` para a lista sair renderizada no SSR. `routes/_app/notes/index.tsx` é o estado vazio ("selecione ou crie uma nota"). Componentes `note-list` e `note-list-item` (título ou "Sem título", trecho, tags, marcador de fixada/lembrete), campo de busca com debounce que escreve em `?q=`, abas/segmentos para `view`. Em telas estreitas, a lista ocupa a tela toda. Ainda **sem** editor: clicar numa nota navega para `/notes/$noteId`, que nesta tarefa só mostra título e corpo em texto.

**Aceite:**
- [x] `/notes` renderiza a lista no SSR (visível com JS desligado); `?q=`/`?tag=`/`?view=` sobrevivem ao reload e valores inválidos caem no default
- [x] Busca digitada atualiza a URL com `replace` (não polui o histórico)
- [x] Estados de lista vazia, carregando (skeleton) e erro tratados
- [x] Layout de duas colunas em desktop; em 375 px a lista ocupa a tela sem scroll horizontal
- [x] `navigation.ts` e `not-found.tsx` continuam apontando para `/notes` (rotas tipadas compilando)

**Verificação:**
- [x] `npm run test -w @septo/web` (unit de `search-params.ts`)
- [x] `npm run check-types` (o `routeTree.gen.ts` regenerado)
- [x] `npm run test:e2e` — as suítes existentes de shell/configurações continuam verdes
- [x] Conferência manual em desktop e 375 px

**Dependências:** T7
**Arquivos:** `apps/web/src/routes/_app/notes.tsx`, `apps/web/src/routes/_app/notes/index.tsx`, `apps/web/src/routes/_app/notes/$noteId.tsx`, `apps/web/src/features/notes/domain/search-params.ts` (+ spec), `apps/web/src/features/notes/components/{note-list,note-list-item}.tsx`
**Tamanho:** L

---

### T9: Editor da nota com Tiptap sob demanda e toolbar

**Descrição:** `/notes/$noteId` passa a montar o editor: `useEditor` com `noteExtensions` e `immediatelyRender: false`, conteúdo carregado com `parseMarkdown` da T1, título num `<Input>` e o corpo no editor. O componente do editor entra por import dinâmico, com skeleton no lugar até carregar. `editor-toolbar.tsx` com os botões do conjunto aprovado (lucide + `@septo/ui/components/button`), estados ativos e `aria-pressed`. Estilo do conteúdo (títulos, listas, citação, código) nos tokens do design system. **Sem autosave ainda**: a edição fica em memória.

**Aceite:**
- [x] Abrir uma nota existente mostra a formatação correta (markdown → editor) e o título editável
- [x] Input rules funcionam: `## `, `- `, `1. `, `> `, `**x**`, `~~x~~`, `` `x` ``
- [x] Toolbar reflete o estado do cursor, é operável por teclado e respeita `prefers-reduced-motion`
- [x] Bundle do editor só carrega em `/notes/$noteId` (chunk separado)
- [x] Nenhum `dangerouslySetInnerHTML` no módulo

**Verificação:**
- [x] `npm run check-types`, `npm run lint`, `npm run test`
- [x] Manual: abrir nota criada por `curl` com markdown variado e comparar com o esperado; aba Network confirma o chunk sob demanda
- [x] `npm run test:e2e` (suítes existentes) com `gotoHydrated`

**Dependências:** T8 (usa o bridge da T1)
**Arquivos:** `apps/web/src/routes/_app/notes/$noteId.tsx`, `apps/web/src/features/notes/components/{note-editor,editor-toolbar}.tsx`
**Tamanho:** L

---

### T10: Autosave com debounce, mutação otimista e criação preguiçosa

**Descrição:** `features/notes/domain/autosave.ts`: máquina de estado pura (`idle` → `dirty` → `saving` → `saved`, com `dirty` durante um save pendente) e debounce de 800 ms, testada com relógio falso. No editor: `useNotesUpdate` com atualização otimista do detalhe, invalidação da lista ao concluir, indicador "Salvando…/Salvo/Erro ao salvar (tentar de novo)", e flush ao desmontar ou trocar de nota. "Nova nota" abre rascunho local em `/notes/new`; o primeiro save chama `useNotesCreate` e substitui a URL pelo id real (`replace`), sem remontar o editor.

**Aceite:**
- [x] Parar de digitar salva em ~800 ms; digitar durante um save agenda o próximo (nada se perde)
- [x] Sair da nota ou desmontar o editor faz flush do que estava pendente
- [x] Indicador reflete os quatro estados; falha de rede mostra erro e permite tentar de novo, sem perder o texto
- [x] Rascunho vazio não cria nota; o primeiro conteúdo cria e a URL passa a ser `/notes/<id>` sem recarregar
- [x] A nota não "pula" de lugar na lista enquanto digito (invalidação só ao concluir)

**Verificação:**
- [x] `npm run test -w @septo/web` (unit de `autosave.ts`, incluindo save durante save e flush)
- [x] Manual: digitar, recarregar, conteúdo persistido; abrir Network offline e ver o estado de erro

**Dependências:** T9
**Arquivos:** `apps/web/src/features/notes/domain/autosave.ts` (+ spec), `apps/web/src/features/notes/components/{note-editor,new-note-button}.tsx`, `apps/web/src/routes/_app/notes/$noteId.tsx`
**Tamanho:** L

---

### T11: Tags: input na nota e filtro por tag na lista

**Descrição:** `features/notes/domain/tags.ts` no web: parse do input (vírgula ou Enter) e a **mesma** normalização da API, com spec espelhando os casos da T3. `tag-input.tsx` mostra as tags como chips removíveis, sugere as existentes (`useTagsList`) e bloqueia acima de 10. Clicar numa tag na lista aplica `?tag=`, com chip de filtro ativo e um jeito de limpar.

**Aceite:**
- [x] Adicionar, remover e sugerir tags funciona; duplicata e tag inválida não entram (mensagem em PT-BR)
- [x] A normalização do web bate com a da API caso a caso (a spec do web usa a mesma tabela da T3)
- [x] Clicar na tag filtra a lista e a URL; limpar volta ao estado anterior
- [x] Mudança de tags passa pelo autosave (não tem botão próprio)

**Verificação:**
- [x] `npm run test -w @septo/web`
- [x] Manual: tag criada numa nota aparece na sugestão de outra

**Dependências:** T10
**Arquivos:** `apps/web/src/features/notes/domain/tags.ts` (+ spec), `apps/web/src/features/notes/components/{tag-input,note-list-item}.tsx`
**Tamanho:** M

---

### T12: Fixar, arquivar/desarquivar e excluir com confirmação

**Descrição:** Ações na lista (menu de contexto no item) e no editor: fixar/desfixar (`useNotesPin`/`useNotesUnpin`), arquivar/desarquivar (`useNotesArchive`/`useNotesUnarchive`) e excluir (`useNotesDelete`) com `delete-note-dialog.tsx` usando `@septo/ui/components/dialog`. Depois de excluir ou arquivar, navega para `/notes` (a nota aberta deixou de existir na view atual).

**Aceite:**
- [x] Fixar move a nota para o topo sem alterar o "editada em" exibido
- [x] Arquivar tira da lista ativa; em `view=archived` aparece com ação de desarquivar
- [x] Excluir abre dialog com texto explícito de que é definitivo; confirmar remove e redireciona; cancelar não faz nada
- [x] Ações acessíveis por teclado, com foco tratado no dialog (Base UI) e rótulos em PT-BR

**Verificação:**
- [x] `npm run check-types`, `npm run lint`, `npm run test`
- [x] Manual: as quatro ações mais o cancelar do dialog

**Dependências:** T11
**Arquivos:** `apps/web/src/features/notes/components/{note-list-item,note-editor,delete-note-dialog}.tsx`
**Tamanho:** M

---

### T13: Lembrete: `remindAt` no editor e filtro "Lembretes"

**Descrição:** `reminder-field.tsx` com `<input type="datetime-local">` (nativo, sem dependência), botão de limpar (`remindAt: null`) e aviso "essa data já passou" quando for o caso — aviso de UI, a API aceita. O item da lista mostra a data do lembrete e o segmento "Lembretes" (`view=reminders`) ordena por data.

**Aceite:**
- [x] Definir data salva via autosave e a nota aparece em "Lembretes"; limpar a remove de lá
- [x] Data no passado salva e mostra o aviso (não bloqueia)
- [x] Conversão local ↔ ISO correta nos dois sentidos (o campo é hora local, o contrato é ISO)
- [x] Data formatada em PT-BR na lista e no editor

**Verificação:**
- [x] `npm run test -w @septo/web` (unit da conversão local ↔ ISO e da checagem de data passada)
- [x] Manual: definir, recarregar, valor idêntico no campo

**Dependências:** T12
**Arquivos:** `apps/web/src/features/notes/components/reminder-field.tsx`, `apps/web/src/features/notes/domain/remind-at.ts` (+ spec), `apps/web/src/features/notes/components/note-list-item.tsx`
**Tamanho:** M

---

## Fase 4: fechamento

### T14: E2E do fluxo de notas

**Descrição:** `apps/web/e2e/notes.spec.ts` (autenticado com o `storageState` existente, **não** destrutivo) cobrindo o fluxo completo. Usa `gotoHydrated` antes de interagir.

**Aceite:**
- [x] Criar nota digitando, ver "Salvo", recarregar e encontrar o conteúdo
- [x] Escrever `## Título`, `- item`, `**negrito**`, `~~riscado~~`, `> citação` e um link; recarregar e a formatação voltar idêntica (prova do round-trip na aplicação real)
- [x] Buscar por termo com acento diferente do digitado e achar a nota
- [x] Adicionar tag e filtrar por ela
- [x] Fixar e conferir que está no topo
- [x] Arquivar, ver em "Arquivadas", desarquivar
- [x] Definir lembrete e ver em "Lembretes"
- [x] Excluir com confirmação e conferir que saiu da lista
- [x] Editar, trocar de nota e voltar: a alteração foi salva (flush do autosave)

**Verificação:**
- [x] `npm run test:e2e` verde, suíte inteira, em 3 execuções seguidas (sem flake)

**Dependências:** T13
**Arquivos:** `apps/web/e2e/notes.spec.ts`, `apps/web/e2e/support/*` (helpers, se precisar de criação de nota via API)
**Tamanho:** L

---

### T15: Cobertura, README, CLAUDE.md, CAPABILITY-MAP e status da spec

**Descrição:** Fechar o módulo: medir cobertura da API, atualizar a documentação e marcar o módulo como implementado.

**Aceite:**
- [x] `npm run coverage -w @septo/api` ≥ 90% de linhas em `modules/notes/{domain,application}`
- [x] README com o que o módulo entrega e qualquer comando novo
- [x] CLAUDE.md com as armadilhas que aparecerem no caminho (bridge markdown, editor sob demanda, `searchText` derivado, `GET /tags` fora de `notes`)
- [x] CAPABILITY-MAP: linha do `notes` com links de spec/plano e status implementado; `reminders` segue como próximo
- [x] SPEC-notes com status atualizado e qualquer decisão que mudou durante a implementação já refletida (regra do projeto: spec antes do código)
- [x] Os 11 Success Criteria da spec verificados um a um

**Verificação:**
- [x] `npm run lint`, `npm run check-types`, `npm run test`, `npm run test:e2e`
- [x] Clone limpo: `npm install && cp .env.example .env && docker compose up -d && npm run db:migrate -w @septo/api && npm run user:set -w @septo/api -- <user> && npm run dev` chega em `/notes` funcionando
- [x] PR aberto referenciando a spec (httpsgabv/septo#3)

**Dependências:** T14
**Arquivos:** `README.md`, `CLAUDE.md`, `CAPABILITY-MAP.md`, `specs/SPEC-notes.md`, `tasks/notes/{plan,todo}.md`
**Tamanho:** M
