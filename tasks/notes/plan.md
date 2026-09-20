# Implementation Plan: notes

> Spec: [SPEC-notes](../../specs/SPEC-notes.md) · Tarefas: [todo.md](todo.md) · Status: **aprovado em 2026-09-20**

## Overview

Notas markdown com editor WYSIWYG (Tiptap), autosave, tags, fixar, arquivar, busca e `remindAt`. O plano ataca o único risco que pode corromper dados — a ponte markdown ↔ editor — na **primeira** tarefa, isolada e sem UI. Depois constrói a API de baixo para cima (migration → domínio → casos de uso → Prisma → HTTP) e só então o web, na ordem lista → editor → autosave → tags → ações → lembrete. A UI de notas é a primeira tela de verdade do septo: até aqui `/notes` era um `EmptyState`.

## Grafo de dependências

```
T1 bridge markdown (web, puro)  ◀── RISCO ALTO, sem dependência: pode ir primeiro ou em paralelo com a API
                                      └────────────────────────────┐
T2 model Note + migration ─▶ T3 domínio (Note, tags, searchText)   │
                              ├─▶ T4 casos de uso de escrita       │
                              └─▶ T5 casos de uso de leitura       │
                                    └─▶ T6 repositório Prisma + mapper
                                          └─▶ T7 HTTP: controllers, schemas, codegen
                                                └─▶ T8 rota /notes: layout, lista, filtros na URL
                                                      └─▶ T9 editor da nota  ◀───────────┘ (usa T1)
                                                            └─▶ T10 autosave + criação preguiçosa
                                                                  ├─▶ T11 tags (input + filtro)
                                                                  ├─▶ T12 fixar, arquivar, excluir
                                                                  └─▶ T13 lembrete (remindAt)
T13 ─▶ T14 e2e do fluxo completo ─▶ T15 docs, cobertura e fechamento
```

## Architecture Decisions

- **Risco primeiro, e fora do caminho de todo mundo.** T1 entrega `features/notes/domain/markdown.ts` com parser, serializer e testes de round-trip **antes** de existir editor na tela. Se o round-trip não fechar para o conjunto aprovado, isso aparece na tarefa 1 e a decisão "markdown no banco" é revisitada com custo zero — nada foi construído em cima ainda.
- **T1 não depende da API.** Pode rodar em paralelo com T2–T7 (arquivos disjuntos: `apps/web/src/features/notes/domain/` vs `apps/api/`).
- **Um commit por tarefa, contrato sempre em dia.** Só a T7 mexe em rota da API, então é a única que roda `npm run codegen` e commita `apps/api/openapi.json`. Não existe tarefa de "regenerar contrato".
- **O web só começa quando o client gerado existe.** T8 em diante consome os hooks do Orval (`useNotesList`, `useNotesUpdate`, …); tentar escrever a UI antes seria escrever contra um contrato imaginário.
- **Leitura separada da escrita (T4/T5).** As regras de consulta (filtro `q`/`tag`/`view`, ordenação com fixadas no topo, teto de 200) são onde mora a maior parte da lógica de listagem, e são testáveis com repositório fake. Separar mantém as duas tarefas pequenas e as specs legíveis.
- **`searchText` e `updatedAt` são responsabilidade da entidade.** O repositório só persiste o que a entidade expõe; `createdAt`/`updatedAt` vêm do domínio (o model não tem `@default(now())` nem `@updatedAt`), então o mapper passa os dois explicitamente. Uma regra do boundary da spec ("`searchText` nunca vem de fora") vira teste na T3.
- **Quatro rotas, dois casos de uso.** `POST`/`DELETE` em `:id/pin` e `:id/archive` são quatro handlers finos sobre `SetNotePinnedUseCase` e `SetNoteArchivedUseCase`, que recebem um booleano.
- **Editor carregado sob demanda.** T9 monta o Tiptap com `immediatelyRender: false` num componente importado por `React.lazy`/import dinâmico, com skeleton no lugar: a rota `/notes` (lista, renderizada no SSR) não puxa ~200 KB de editor.
- **Autosave depois do editor funcionar.** T9 carrega e edita em memória; T10 acrescenta debounce, mutação otimista, indicador e a criação preguiçosa (`POST` no primeiro save). Assim, se o autosave der problema, o editor já está provado.
- **Sem estado global no web.** Filtros vivem na URL (`validateSearch` com zod), dados vivem no cache do TanStack Query. Nada de contexto novo.
- **E2E ao final, numa tarefa só.** As asserções dependem de quase toda a UI (criar, buscar, filtrar, fixar, arquivar, excluir, lembrete); espalhar meia suíte por tarefa custaria mais retrabalho do que entrega. As suítes rodam autenticadas com o `storageState` existente e **não** são `*.destructive` (não tocam sessão nem senha).

## Task List

### Fase 1: risco — ponte markdown (web, isolado)
- [x] T1: Dependências do Tiptap + bridge markdown com testes de round-trip ⚠️ risco alto

### Checkpoint A: o round-trip fecha
- [ ] Tabela de casos (títulos, ênfases, riscado, código, listas aninhadas, citação, link, hr, quebra de linha, escapes, vazio) volta byte a byte
- [ ] `lint`, `check-types`, `test` passam
- [ ] Revisão com você antes de seguir — é aqui que "markdown no banco" se confirma

### Fase 2: API
- [x] T2: Model `Note` + migration
- [x] T3: Domínio: entidade `Note`, tags, `searchText`, erros e porta
- [x] T4: Casos de uso de escrita (criar, atualizar, fixar, arquivar, excluir, obter)
- [x] T5: Casos de uso de leitura (listar notas com filtros e ordenação, listar tags)
- [x] T6: Repositório Prisma + mapper
- [x] T7: HTTP: `NotesController`, `TagsController`, schemas zod e `openapi.json`

### Checkpoint B: API completa
- [ ] `curl` autenticado: criar → listar → buscar acento-insensível → filtrar por tag → fixar → arquivar → excluir
- [ ] Sem cookie, toda rota do módulo responde `401`; `POST` vazio responde `422 NOTE_EMPTY`
- [ ] As dez operações aparecem no Scalar em `/api/docs` e os hooks existem no client gerado
- [ ] Revisão com você antes de seguir

### Fase 3: web
- [x] T8: Rota `/notes` como layout de duas colunas, lista no SSR e filtros na URL
- [x] T9: Editor da nota (`/notes/$noteId`) com Tiptap sob demanda e toolbar
- [x] T10: Autosave com debounce, mutação otimista e criação preguiçosa da nota nova
- [x] T11: Tags: input na nota e filtro por tag na lista
- [x] T12: Fixar, arquivar/desarquivar e excluir com confirmação
- [x] T13: Lembrete: `remindAt` no editor e filtro "Lembretes"

### Checkpoint C: fluxo completo no navegador
- [ ] Digitar → "Salvo" → recarregar → conteúdo e formatação idênticos
- [ ] Buscar, filtrar por tag, fixar, arquivar, excluir e definir lembrete funcionam pela UI
- [ ] Revisão visual com você (desktop e 375 px), tema claro e escuro
- [ ] A rota `/notes` não carrega o bundle do editor até abrir uma nota (aba Network)

### Fase 4: fechamento
- [x] T14: E2E do fluxo de notas
- [ ] T15: Cobertura, README, CLAUDE.md, CAPABILITY-MAP e status da spec

### Checkpoint final
- [ ] Todos os 11 Success Criteria da spec verificados
- [ ] `lint`, `check-types`, `test`, `test:e2e` verdes; `openapi.json` commitado e igual ao gerado
- [ ] Revisão final com você

## Paralelização

- **T1 ‖ T2–T7**: bridge (web) e API não compartilham arquivo. É o único paralelismo com ganho real.
- **T4 ‖ T5**: arquivos distintos em `application/`, mas ambos dependem da porta da T3 e as duas mexem no `notes.module.ts` no fim. Sequenciais é mais barato que resolver conflito.
- **T11, T12 e T13** tocam o mesmo editor e a mesma lista (`note-list-item.tsx`, `note-editor.tsx`) — sequenciais.
- T8 → T9 → T10 é dependência real: layout antes do editor, editor antes do autosave.

## Risks and Mitigations

| Risco | Impacto | Mitigação |
|---|---|---|
| O round-trip markdown perde ou altera formatação (dado corrompido a cada save) | **Alto** | T1 é a primeira tarefa, isolada, guiada por tabela de casos e escrita em TDD. Construções fora do conjunto aprovado (tabela, imagem, checklist num markdown colado) têm comportamento decidido e testado, não acidental |
| Importar `@tiptap/starter-kit` num teste Vitest em ambiente `node` falhar por tocar `window`/`document` no carregamento | Médio | T1 descobre isso no primeiro teste. Plano A: montar o schema com `getSchema()` sem importar nada ligado à view. Plano B: `// @vitest-environment jsdom` nesses specs, o que exige a devDependency `jsdom` (fora da tabela da spec — **peço aprovação** se cair aqui) |
| Tiptap não renderiza no SSR (TanStack Start) e quebra a hidratação da rota | Médio | T9 usa `immediatelyRender: false` + import dinâmico com skeleton; o e2e usa o helper `gotoHydrated` já existente |
| Autosave perde a última alteração ao navegar ou fechar a nota | Médio | T10 faz flush no desmonte e ao trocar de nota; a máquina de estado é pura e testada com relógio falso; o e2e cobre "editar, trocar de nota, voltar" |
| Autosave otimista briga com a invalidação da lista (nota pula de lugar enquanto digito) | Médio | A mutação atualiza o cache do detalhe e só invalida a lista quando o save conclui; a ordenação é sempre do servidor |
| `updatedAt`/`createdAt` sem default no Prisma: um caminho que esqueça de passá-los falha em runtime | Baixo | T6 concentra isso no mapper, com teste de integração de criação e de edição; o `check-types` já exige os campos |
| `String[]` do Postgres via `@prisma/adapter-pg` com filtro `has` | Baixo | T6 testa `has` contra o Postgres real (não só o fake) |
| Bundle do editor pesar nas outras rotas | Baixo | Import dinâmico verificado no Checkpoint C pela aba Network |
| Trecho de 160 caracteres cortar no meio de um `**` e ficar feio na lista | Baixo | Aceito na spec (`// ponytail:`), visível na revisão visual do Checkpoint C |

## Open Questions

- **Meta de cobertura ≥ 90%**: o `@vitest/coverage-v8` já está na API (adicionado no identity), então `npm run coverage -w @septo/api` mede `domain/` e `application/` do notes sem dependência nova. No **web** não há coverage configurado; a T15 vai medir só a API e tratar a meta do web (o bridge e as funções puras) como diretriz de TDD, sem número medido — a menos que você queira configurar coverage no web também.
- **`GET /tags` ignora notas arquivadas** (decisão da spec). Se uma tag só existir em notas arquivadas, ela desaparece do filtro; desarquivar a nota a traz de volta. Comportamento intencional, mas é o tipo de coisa que surpreende depois — está coberto por teste na T5.
