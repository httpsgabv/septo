# Spec: notes

> Módulo `notes` do [CAPABILITY-MAP](../CAPABILITY-MAP.md). Status: **aprovada** em 2026-09-20. Plano: [tasks/notes/plan.md](../tasks/notes/plan.md).
> Herda as convenções globais de [SPEC-foundation](SPEC-foundation.md): camadas, contrato zod → OpenAPI → Orval, estilo, testes e limites. Depende de [SPEC-identity](SPEC-identity.md) — toda rota deste módulo nasce protegida pelo `AuthGuard` global. Aqui fica só o que é específico do módulo.

## Objetivo

Dar ao septo a ferramenta que substitui o app de notas: escrever em markdown num editor WYSIWYG, organizar com tags, fixar o que importa, arquivar o que passou e achar qualquer coisa pela busca. Lembrete não é outra entidade — é uma nota com `remindAt`; este módulo é dono do campo, e o módulo `reminders` só cuida da entrega (Web Push).

Sucesso = abro `/notes`, começo a digitar e a nota se salva sozinha; encontro qualquer nota antiga por texto ou tag em um campo de busca; e marco uma data num lembrete que o módulo seguinte vai disparar.

### Histórias

1. Em `/notes` vejo a lista das notas ativas: fixadas primeiro, depois as editadas mais recentemente, cada uma com título, trecho e tags.
2. Clico em "Nova nota" e já começo a escrever. O editor é WYSIWYG: `## `, `- `, `**negrito**` e `> ` viram formatação enquanto digito, e o que é salvo é markdown.
3. Não existe botão Salvar — paro de digitar e a nota é salva, com um indicador "Salvando… / Salvo".
4. Ponho tags numa nota e filtro a lista por uma tag com um clique.
5. Busco por texto e a lista filtra por título e corpo, ignorando acento e caixa ("anotacao" acha "Anotação").
6. Fixo uma nota e ela passa a aparecer no topo, independente da data de edição.
7. Arquivo uma nota: ela sai da lista principal e continua acessível no filtro "Arquivadas", de onde posso desarquivar.
8. Excluo uma nota de vez, com confirmação. Excluir é definitivo (arquivar é o passo reversível).
9. Defino data e hora de lembrete numa nota e vejo o filtro "Lembretes" com os próximos em ordem de data.
10. Abrir uma nota direto pela URL (`/notes/<id>`) funciona, e o filtro de busca/tag também fica na URL — recarregar mantém o que eu estava vendo.

### Fora de escopo (v1)

Blocos de código com destaque de sintaxe, checklists (`- [ ]`), tabelas, imagens e anexos, colar imagem, pastas/cadernos, notas vinculadas (`[[wiki-links]]`), histórico de versões, lixeira com restauração, compartilhar nota, exportar/importar em massa, ordenação manual (arrastar), cor por tag, renomear tag em massa, notas por usuário (`ownerId` — o app tem um usuário só, decisão do `identity`), busca com ranking/stemming, recorrência de lembrete e qualquer coisa de Web Push (módulo `reminders`).

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Editor | **Tiptap 3** (`@tiptap/react` + `StarterKit`), WYSIWYG, com as input rules do markdown ligadas | Escolha do usuário (2026-09-20). As input rules dão a sensação de markdown sem exigir que eu escreva a sintaxe |
| Formatação suportada | Títulos (h1–h3), negrito, itálico, riscado, código inline, bloco de código simples, listas com e sem marcador (aninháveis), citação, link, linha horizontal, quebra de linha | Conjunto "básico" aprovado. Bloco de código simples entra porque o serializer do markdown já o cobre de graça — o que ficou fora é o **destaque de sintaxe** (`lowlight`) |
| Formato guardado | **Markdown** na coluna `body` | Mantém a decisão do mapa: nota portátil, corpo legível para busca e para o texto do push do `reminders` |
| Ponte markdown ↔ editor | **Bridge próprio** com `prosemirror-markdown` (oficial, 1.13.7), em `features/notes/domain/markdown.ts`: um `MarkdownParser` e um `MarkdownSerializer` escritos contra o schema do Tiptap, com testes de round-trip | `tiptap-markdown` (comunidade, 0.9.0) está sem publicação desde 08/09/2025; não quero um 0.x parado no caminho dos meus dados. Os defaults do `prosemirror-markdown` usam nomes de nó `snake_case` (`bullet_list`) e o Tiptap usa `camelCase` (`bulletList`), então os mapas são escritos à mão de qualquer jeito |
| Riscado no markdown | O `markdown-it` é instanciado no preset `default` (não `commonmark`) para habilitar `~~riscado~~`, e o serializer emite `~~` para a mark `strike` | O default do `prosemirror-markdown` é `commonmark`, que não tem strikethrough — é a única lacuna conhecida do conjunto aprovado |
| Salvamento | **Autosave** com debounce de 800 ms, mutação otimista no TanStack Query e indicador "Salvando…/Salvo"; o autosave é liberado (flush) ao sair da nota ou desmontar o editor. Sem botão Salvar | Escolha do usuário. Um usuário só = sem edição concorrente, sem conflito a resolver |
| Criação preguiçosa | "Nova nota" não chama a API: abre um rascunho local e o `POST /notes` acontece no primeiro autosave, quando já existe conteúdo; a URL é substituída pelo id real (`replace`) | Evita nota vazia no banco a cada clique. `POST` com título e corpo vazios responde `422 NOTE_EMPTY` |
| Tags | Coluna `tags String[]` na nota | Sem tabela nem join; listar as tags existentes é um `distinct` sobre `unnest`. Sem cor nem descrição por tag (fora de escopo) |
| Normalização de tag | `trim`, minúsculas, sem duplicata, no máximo 10 por nota, 1 a 30 caracteres, padrão `[\p{L}\p{N}._-]+` (espaço vira `-`) | Tag é rótulo, não texto livre; normalizar na entidade evita `Trabalho` e `trabalho` |
| Busca | Coluna derivada `searchText` (título + corpo normalizados: sem acento, minúsculas), consultada com `contains` do Prisma | Acento-insensível sem `unaccent` nem SQL cru, e reusa a mesma normalização que o web já faz em `shared/search.ts`. `searchText` é calculado **dentro da entidade** — nunca vem de fora |
| Limite da busca | Sem ranking, sem stemming, sem paginação: a listagem tem teto fixo de 200 notas | `// ponytail: busca por substring e teto de 200; trocar por tsvector + paginação por cursor quando a lista passar disso` |
| Índices | Nenhum além da PK na v1 | Algumas centenas de linhas: o seq scan é irrelevante. `// ponytail: GIN em tags e pg_trgm em searchText quando o EXPLAIN pedir` |
| Ordenação | Fixadas primeiro (`pinnedAt` desc), depois `updatedAt` desc. O filtro "Lembretes" ordena por `remindAt` asc | — |
| `updatedAt` | Controlado pelo domínio (sem `@updatedAt` do Prisma): só muda quando título, corpo, tags ou lembrete mudam | Fixar ou arquivar não deve reordenar a lista por "última edição" |
| Relógio | Casos de uso expõem `now = () => new Date()`, substituído nos testes | Padrão já usado no `identity`; não cria porta nova |
| Fixar / arquivar | Quatro rotas explícitas (`POST`/`DELETE` em `:id/pin` e `:id/archive`) sobre **dois** casos de uso que recebem um booleano | REST explícito na borda, metade do código na aplicação |
| Excluir | `DELETE /notes/:id` apaga de verdade, sem lixeira; a UI confirma num dialog | Arquivar já é o passo reversível |
| `remindAt` | Instante ISO opcional na nota, editado com `<input type="datetime-local">`. A API aceita data no passado; a UI avisa ("essa data já passou") | Editar uma nota antiga não pode falhar por causa de um lembrete vencido. O `reminders` ignora o que já passou |
| Trecho na lista | Os primeiros 160 caracteres do markdown, gerado no `presentation` da API | `// ponytail: trecho é markdown cru fatiado; renderizar para texto puro se ficar feio` |
| Filtros na URL | `?q=`, `?tag=` e `?view=active\|archived\|reminders` validados com zod no `validateSearch` da rota | Recarregar e compartilhar link mantêm o estado; o SSR já renderiza a lista filtrada |
| Layout | `/notes` é rota de layout com duas colunas: lista à esquerda, nota à direita (`Outlet`). Em telas estreitas, a lista ocupa a tela e abrir uma nota navega para o editor | Mesma estrutura de um app de notas; sem estado global |
| SSR do editor | A lista é renderizada no SSR; o editor é `immediatelyRender: false` e carregado sob demanda (chunk separado), com skeleton no lugar | O Tiptap não renderiza no servidor, e o bundle (~200 KB) não deve pesar nas outras rotas |

## Contrato da API

Todas sob `/api`, todas **protegidas** (nenhum `@Public()` neste módulo). Erros no padrão `{ code, message }` do foundation.

| Método e rota | Handler (operationId) | Entrada | Sucesso | Erros |
|---|---|---|---|---|
| `GET /notes` | `notesList` | query: `q?`, `tag?`, `view?` (`active` default, `archived`, `reminders`) | `200 NoteSummary[]` | `400`, `401` |
| `POST /notes` | `notesCreate` | `{ title?, body?, tags?, remindAt? }` | `201 Note` | `400`, `401`, `422 NOTE_EMPTY` |
| `GET /notes/:id` | `notesGet` | — | `200 Note` | `401`, `404 NOTE_NOT_FOUND` |
| `PATCH /notes/:id` | `notesUpdate` | `{ title?, body?, tags?, remindAt? }` (campo ausente não muda; `remindAt: null` limpa) | `200 Note` | `400`, `401`, `404`, `422 NOTE_EMPTY` |
| `POST /notes/:id/pin` | `notesPin` | — | `200 Note` | `401`, `404` |
| `DELETE /notes/:id/pin` | `notesUnpin` | — | `200 Note` | `401`, `404` |
| `POST /notes/:id/archive` | `notesArchive` | — | `200 Note` | `401`, `404` |
| `DELETE /notes/:id/archive` | `notesUnarchive` | — | `200 Note` | `401`, `404` |
| `DELETE /notes/:id` | `notesDelete` | — | `204` | `401`, `404` |
| `GET /tags` | `tagsList` | — | `200 string[]` (ordem alfabética, só de notas não arquivadas) | `401` |

`GET /tags` fica num `TagsController` separado (dentro do módulo `notes`) para não disputar rota com `GET /notes/:id` — com `@Controller('notes')` a ordem de declaração decidiria, e isso é uma armadilha silenciosa.

```ts
// Note (components/schemas/Note)
{
  id: string /* uuid */;
  title: string;
  body: string /* markdown */;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  remindAt: string | null /* ISO */;
  createdAt: string /* ISO */;
  updatedAt: string /* ISO */;
}

// NoteSummary (components/schemas/NoteSummary) — Note sem `body`, com `excerpt`
{ id, title, excerpt: string, tags, pinned, archived, remindAt, createdAt, updatedAt }
```

`pinnedAt`/`archivedAt` são detalhe de persistência: o contrato expõe booleanos. Limites de entrada: `title` ≤ 200 caracteres, `body` ≤ 100.000, `q` ≤ 200, até 10 tags.

## Modelo de dados

```prisma
model Note {
  id         String    @id @default(uuid()) @db.Uuid
  title      String
  body       String                      // markdown
  searchText String                      // title + body normalizados (derivado, nunca vem da API)
  tags       String[]  @default([])
  pinnedAt   DateTime?
  archivedAt DateTime?
  remindAt   DateTime?
  createdAt  DateTime
  updatedAt  DateTime                    // controlado pelo domínio

  @@map("notes")
}
```

Segunda migration do projeto (`npm run db:migrate -w @septo/api`). Sem `ownerId` (um usuário só). Sem índices na v1 — ver a linha "Índices" nas decisões.

## Estrutura

```
apps/api/src/modules/notes/
  domain/          note.ts, note.repository.ts (porta), tags.ts (VO), search-text.ts, errors.ts
  application/     create-note, get-note, list-notes, update-note, set-note-pinned, set-note-archived,
                   delete-note, list-tags — um *.use-case.ts cada
  infrastructure/  note.prisma-repository.ts, note.mapper.ts
  presentation/    notes.controller.ts, tags.controller.ts, notes.schemas.ts (zod + mappers de resposta)
  notes.module.ts

apps/web/src/
  routes/_app/notes.tsx            layout: coluna da lista + Outlet (validateSearch de q/tag/view)
  routes/_app/notes/index.tsx      estado vazio ("selecione ou crie uma nota")
  routes/_app/notes/$noteId.tsx    editor da nota
  features/notes/
    domain/markdown.ts             bridge prosemirror-markdown ↔ schema do Tiptap (puro, testável sem DOM)
    domain/tags.ts                 parse do input de tags (vírgula/Enter) e normalização, espelhando a API
    domain/search-params.ts        schema zod de q/tag/view
    domain/autosave.ts             máquina de estado do autosave (idle/dirty/saving/saved) — pura
    components/                    note-list, note-list-item, note-editor, editor-toolbar, tag-input,
                                   reminder-field, delete-note-dialog, new-note-button
```

## Dependências novas (pedem aprovação)

| Pacote | Versão | Onde | Motivo |
|---|---|---|---|
| `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` | 3.31.3 | web | Editor WYSIWYG escolhido. `StarterKit` já traz os nós/marks do conjunto aprovado, inclusive `Link` |
| `prosemirror-markdown` | 1.13.7 | web | Parser e serializer markdown do bridge. Oficial do ProseMirror e mantido (última publicação 31/08/2026). **Não** vem dentro do `@tiptap/pm` (conferido: o `@tiptap/pm` traz view/model/state/transform/commands/keymap/history/tables/list/inputrules, sem markdown) |

Descartados: `tiptap-markdown` (0.9.0, sem publicação desde 08/09/2025); `lowlight`/`@tiptap/extension-code-block-lowlight` (destaque de sintaxe está fora de escopo); `@tiptap/extension-table` e `TaskList` (fora de escopo); `@tiptap/static-renderer` (o editor não é renderizado no SSR); `use-debounce` e afins (o debounce do autosave são ~10 linhas).

Nada novo na API — a busca usa o Prisma, a normalização é TS puro.

## Testes

| Nível | Cobre |
|---|---|
| Unit (API) | Entidade `Note`: criação rejeita título e corpo vazios (`NOTE_EMPTY`), edição atualiza `updatedAt` e recalcula `searchText`, fixar/arquivar **não** mexem em `updatedAt`, idempotência de fixar/arquivar duas vezes, normalização e limites das tags, `remindAt` nulo limpa o lembrete. Casos de uso com repositório fake e `now` fixo, inclusive `404` em nota inexistente e ordenação/filtro do `list-notes` |
| Unit (web) | Round-trip do markdown, guiado por tabela: títulos h1–h3, negrito/itálico/riscado, código inline, bloco de código, listas aninhadas dos dois tipos, citação, link, linha horizontal, quebra de linha, escape de caracteres especiais (`*`, `_`, `#` no início da linha) e documento vazio. Parse de tags, `search-params`, máquina de estado do autosave (com relógio falso) |
| Integração (API) | CRUD por HTTP com Postgres real; `401` em todas as rotas sem cookie; filtro `q` acento- e caixa-insensível; filtro por tag; `view=archived` e `view=reminders` com a ordenação certa; fixadas antes das demais; teto de 200; `GET /tags` traz tags distintas e ignora arquivadas; `DELETE` remove e o `GET` seguinte dá `404`; `415` numa mutação com corpo não-JSON |
| Contrato | `openapi.json` regenerado e commitado (teste existente) |
| E2E | Criar nota digitando e ver "Salvo"; recarregar e o conteúdo persiste; formatar com input rule (`## `) e o markdown voltar formatado depois do reload; buscar; filtrar por tag; fixar e ver no topo; arquivar/desarquivar; excluir com confirmação; definir lembrete e ver no filtro "Lembretes". As suítes rodam autenticadas com o `storageState` existente e não são `*.destructive` (não tocam sessão nem senha) |

Meta: ≥ 90% de linhas em `domain/` e `application/` do notes, como nos módulos anteriores.

## Boundaries

- **Sempre:** `searchText` é derivado dentro da entidade a partir de título e corpo — nenhum caso de uso, controller ou repositório o define; toda rota nova do módulo continua protegida (sem `@Public()`); markdown vindo da API é tratado como dado, nunca injetado como HTML fora do editor; regenerar e commitar o `openapi.json`.
- **Perguntar antes:** trocar o formato guardado (markdown ↔ JSON do ProseMirror); ampliar o conjunto de formatação (tabelas, checklists, imagens, destaque de sintaxe); adicionar extensão do Tiptap ou qualquer dependência fora da tabela acima; mudar de busca por substring para full-text (mexe em migration); introduzir `ownerId`.
- **Nunca:** renderizar markdown com `dangerouslySetInnerHTML` (o Tiptap faz o parse; não há renderer HTML neste módulo); usar Prisma fora de `infrastructure`; chamar a API sem passar pelo client do Orval; editar o bridge de markdown sem atualizar os testes de round-trip.

## Success Criteria

1. `GET /api/notes` sem cookie responde `401`; com sessão válida responde `200 []` num banco limpo.
2. Digitar numa nota nova cria a nota no primeiro autosave e mostra "Salvo" em menos de 2 s; recarregar a página traz título, corpo, tags e lembrete iguais.
3. Escrever `## Título`, `- item`, `**negrito**`, `~~riscado~~`, `> citação` e um link no editor, recarregar, e a formatação volta idêntica — provando que o round-trip markdown não perde nada do conjunto aprovado. O `body` guardado no banco é markdown legível.
4. `POST /api/notes` com título e corpo vazios responde `422 { code: "NOTE_EMPTY" }`; clicar em "Nova nota" e sair sem escrever não deixa nota no banco.
5. Buscar "anotacao" acha a nota "Anotação"; o filtro fica em `?q=` e sobrevive ao reload, renderizado já no SSR.
6. Uma nota com a tag `trabalho` aparece ao filtrar por ela, e `Trabalho `, `  trabalho` e `trabalho` viram a mesma tag. `GET /api/tags` lista cada tag uma vez.
7. Fixar uma nota a leva para o topo sem alterar o "editada em"; arquivar a remove da lista ativa e ela aparece em "Arquivadas", de onde desarquivar a devolve.
8. Definir lembrete numa nota a faz aparecer no filtro "Lembretes", ordenado por data; limpar o campo (`remindAt: null`) a remove de lá. O `reminders` consegue ler tudo que precisa sem migration nem mudança de contrato.
9. Excluir pede confirmação; depois de confirmar, `GET /api/notes/:id` responde `404`.
10. `/notes` e `/notes/:id` funcionam em desktop e em 375 px de largura sem scroll horizontal; a rota `/notes` não carrega o bundle do editor até abrir uma nota.
11. `lint`, `check-types`, `test` e `test:e2e` passam; `openapi.json`, README, CLAUDE.md e CAPABILITY-MAP atualizados.

## Riscos

| Risco | Mitigação |
|---|---|
| O bridge markdown perde formatação num round-trip (o erro cai direto nos meus dados) | Testes de round-trip guiados por tabela são a primeira tarefa do plano, escritos antes do editor aparecer na tela; o conjunto de formatação é pequeno e fechado por decisão. Construções fora do conjunto que o parser encontrar (tabela, imagem, checklist num markdown colado) são preservadas como texto ou descartadas — o comportamento escolhido fica documentado no teste |
| Nomes de nó do Tiptap (`bulletList`) ≠ defaults do `prosemirror-markdown` (`bullet_list`) | Os mapas de token e de serialização são escritos à mão contra `getSchema(extensions)`, não copiados dos defaults; o teste de round-trip pega qualquer nó não mapeado |
| Tiptap não renderiza no SSR e pesa no bundle | `immediatelyRender: false`, editor num chunk sob demanda, skeleton no lugar. A lista, que é o conteúdo que importa no SSR, é renderizada normalmente |
| Autosave perde a última alteração ao navegar rápido | Flush no desmonte e ao trocar de nota, coberto no e2e ("editar, trocar de nota, voltar") |
| Autosave otimista deixa a lista fora de ordem (o `updatedAt` muda) | A mutação atualiza o cache do detalhe e invalida a lista; a ordenação é do servidor |
| Busca por substring e teto de 200 notas não escalam | Aceito e marcado com `// ponytail:`. A troca por `tsvector` + paginação por cursor é local (repositório + schema de query) |
| Colar um texto gigante no editor | `body` limitado a 100.000 caracteres na validação zod, com mensagem clara na UI |

## Open Questions

Nenhuma. Os três julgamentos abaixo foram confirmados na aprovação de 2026-09-20 e são reversíveis sem migration:

1. **Excluir é definitivo, sem lixeira** — arquivar já é o passo reversível. Se preferir lixeira com restauração, é um `deletedAt` a mais.
2. **`remindAt` no passado é aceito pela API**, com aviso só na UI. A alternativa é `422` quando a data muda para o passado.
3. **Trecho da lista = 160 caracteres de markdown cru** (pode aparecer um `##` ou `**` no meio). A alternativa é converter para texto puro na API.
