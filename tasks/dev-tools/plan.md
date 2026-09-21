# Implementation Plan: dev-tools

> Spec: [SPEC-dev-tools](../../specs/SPEC-dev-tools.md) · Tarefas: [todo.md](todo.md) · Status: **aprovado em 2026-09-21**

## Overview

Seis ferramentas que rodam inteiras no navegador, sem API, sem banco e sem persistência. Como não há contrato a construir, o plano não tem "de baixo para cima": tem uma **casca** (layout, índice, `ToolPage`) e depois seis fatias verticais independentes, cada uma com seu domínio puro testado e sua tela.

A única coisa que pode quebrar algo que já funciona é mover o bridge de markdown de `features/notes/domain/` para `shared/` — então essa é a T1, isolada, com o round-trip e o e2e de notas como rede.

## Grafo de dependências

```
T1 mover o bridge markdown → shared/  ◀── única tarefa que toca o `notes`; isolada, primeiro commit
      │
      │        T2 casca: layout /dev-tools, índice, tools.ts, ToolPage, seis rotas stub
      │              ├─▶ T3  JSON            (domain/json.ts      + tela)
      │              ├─▶ T4  Encodings       (domain/encoding.ts  + FileDrop + tela)
      │              ├─▶ T5  deps + domain/data.ts  ─▶  T6 Conversor de dados (tela)
      │              ├─▶ T7  Imagens         (domain/image.ts     + tela, usa o FileDrop da T4)
      │              ├─▶ T8  RSA             (domain/rsa.ts       + tela)
      └──────────────┴─▶ T9  Leitor de README (usa shared/markdown.ts da T1)
                             │
                             └─▶ T10 e2e das seis ferramentas ─▶ T11 docs, cobertura e fechamento
```

## Architecture Decisions

- **O risco é o `notes`, não as ferramentas.** Nenhuma ferramenta pode corromper dado (não há dado guardado). O único jeito de este módulo quebrar algo é a T1 mexer no arquivo que serializa as notas — por isso ela vem primeiro, sozinha, e termina rodando `notes.spec.ts` (e2e) além do round-trip.
- **A casca antes das ferramentas.** T2 entrega layout, índice e as seis rotas como stub. O roteador do TanStack é tipado: um card do índice apontando para `/dev-tools/rsa` só compila se a rota existir. Seis arquivos de seis linhas criados de uma vez custam menos que seis tarefas que voltam no índice para "ligar o link".
- **Uma fatia vertical por ferramenta.** Cada uma das T3–T9 entrega domínio puro (escrito em TDD) + tela + a rota trocada, e é verificável sozinha no navegador. Nenhuma depende da outra; a ordem abaixo é do mais simples para o mais chato, para que a forma do `ToolPage` se prove cedo.
- **Domínio puro em `node`, navegador só no que é navegador.** O Vitest do web roda em ambiente `node`, sem DOM. JSON, dados, encodings, PEM e o cálculo de redimensionamento são funções puras e têm teste unitário; canvas e download são cobertos no e2e (Chromium de verdade). WebCrypto tem teste unitário porque o Node 24 o expõe em `globalThis.crypto`.
- **Deps de parser numa tarefa só (T5), antes da tela.** `js-yaml`, `papaparse` e `fast-xml-parser` entram junto com `domain/data.ts`: se algum tiver problema de ESM/CJS no Vitest ou no SSR, isso aparece numa tarefa sem UI, e a decisão (trocar a lib) é barata.
- **Nada pesado fora do chunk da ferramenta.** Parsers, canvas, WebCrypto e Tiptap só são importados dentro do componente carregado por `lazy` em `ClientOnly`. É a mesma armadilha do editor de notas, e o e2e confere.
- **Zero tarefa de contrato.** Nenhuma tarefa roda `npm run codegen`; `apps/api/openapi.json` tem que sair deste módulo **byte a byte igual** — isso é um item do checkpoint final, não uma tarefa.
- **E2E numa tarefa só, no fim.** Seis ferramentas, um arquivo de suíte, escrito quando as seis existem. Não é destrutiva (não toca sessão, senha nem notas) e roda com o `storageState` que já existe.

## Task List

### Fase 1: risco — o bridge compartilhado
- [x] T1: Mover `markdown.ts` para `shared/` e renomear `noteExtensions` ⚠️ toca o `notes`

### Checkpoint A: as notas continuam inteiras
- [x] `markdown.spec.ts` passa sem nenhuma mudança de caso
- [x] `npm run test:e2e -w @septo/web -- notes.spec.ts` verde (editor abre, digita, salva, recarrega)
- [x] `grep` não acha mais nada importando `features/notes/domain/markdown`

### Fase 2: casca
- [x] T2: Layout `/dev-tools`, índice com os cards, `domain/tools.ts`, `ToolPage` e as seis rotas stub

### Checkpoint B: o esqueleto navega
- [x] As seis rotas abrem pela URL direta e pelo card; o ⌘K e o `shell.spec.ts` seguem verdes
- [x] O índice renderiza no SSR e não baixa nada além do bundle do app

### Fase 3: as seis ferramentas
- [x] T3: Formatador JSON
- [x] T4: Encodings (base64, base64url, URL, hex) + `FileDrop`
- [ ] T5: Dependências de parser + `domain/data.ts` (JSON/YAML/CSV/XML)
- [ ] T6: Tela do conversor de dados
- [ ] T7: Conversor de imagens
- [ ] T8: Gerador RSA
- [ ] T9: Leitor de README

### Checkpoint C: as seis funcionam no navegador
- [ ] Cada ferramenta resolve o caso da sua história (spec, seção "Histórias")
- [ ] Nenhuma requisição para `/api/*` ao usar qualquer ferramenta; `localStorage` vazio depois de usar as seis
- [ ] Desktop e 375 px sem scroll horizontal, tema claro e escuro
- [ ] Revisão visual com você

### Fase 4: fechamento
- [ ] T10: E2E das seis ferramentas
- [ ] T11: Cobertura, README, CLAUDE.md, CAPABILITY-MAP e status da spec

### Checkpoint final
- [ ] Os 10 Success Criteria da spec verificados
- [ ] `lint`, `check-types`, `test`, `test:e2e` verdes
- [ ] `git diff main -- apps/api` vazio: o módulo não tocou a API nem o `openapi.json`

## Paralelização

- **T1 ‖ T2**: arquivos disjuntos (`features/notes` + `shared/markdown.ts` vs `routes/_app/dev-tools*` + `features/dev-tools`). É o paralelismo com ganho real.
- **T3, T4, T5, T7, T8 ‖ entre si**: cada uma mexe só no seu `domain/<tool>.ts`, no seu componente e na sua rota. O `tools.ts` já ficou pronto na T2, então não há arquivo compartilhado para conflitar. Na prática vão sair em série (uma sessão cada), mas nada impede o contrário.
- **T4 → T7**: o `FileDrop` nasce na T4 e a imagem o reusa. Se a T7 vier antes, é ela que o cria.
- **T5 → T6** e **T1 → T9**: dependências reais.
- **T10 depois de T9**: a suíte cobre as seis.

## Risks and Mitigations

| Risco | Impacto | Mitigação |
|---|---|---|
| Mover o bridge quebra o editor de notas, entregue na semana passada | **Alto** | T1 isolada, primeiro commit, sem nenhuma outra mudança junto. `markdown.spec.ts` vai junto e não muda um caso sequer; o e2e de notas roda antes de fechar a tarefa. Reverter é um `git revert` de um commit |
| `papaparse` é CJS e pode brigar com o ESM do Vitest/SSR (`default` interop) | Médio | Descoberto na T5, que não tem UI. Plano A: `import Papa from 'papaparse'` (interop do Vite resolve). Plano B: import dinâmico dentro da função. Plano C: trocar por um parser CSV próprio de ~40 linhas — o formato que suportamos (lista de objetos planos) é pequeno. **Peço aprovação antes de trocar de lib** |
| Parser ou canvas vazando para o bundle do índice (como quase aconteceu com o Tiptap em `/notes`) | Médio | Importados só dentro do componente da ferramenta, que é `lazy` dentro de `ClientOnly`; conferido no Checkpoint B e no e2e da T10 sobre o **build de produção** |
| WebCrypto ausente no ambiente `node` do Vitest | Baixo | Node 24 expõe `globalThis.crypto.subtle`; se faltar, `import { webcrypto } from 'node:crypto'` no topo do spec (sem dependência nova) |
| `toBlob` do canvas não encoda WebP/AVIF no navegador do dia | Baixo | Detecção em runtime (encoda 1×1 e confere o mimetype do blob); a opção some quando não é suportada, em vez de baixar um PNG com nome errado |
| Download no Playwright | Baixo | `page.waitForEvent('download')` com `acceptDownloads` (padrão); o teste confere o nome e o tamanho do arquivo, não o conteúdo do pixel |
| "Nenhuma requisição sai" é difícil de asseverar com o dev server (HMR, Vite) | Baixo | O e2e afirma só o que importa e é estável: nenhuma requisição para `/api/*` e nenhuma para origem diferente da do app |
| Gerar RSA 4096 travar a interface | Baixo | `crypto.subtle.generateKey` é assíncrono e roda fora do main thread; o botão vai para "Gerando…" e a T8 mede o tempo no e2e com teto de 10 s |
| Seis telas com seis jeitos diferentes | Baixo | `ToolPage` e `CopyButton` nascem na T2/T3 e todas as outras os reusam — a revisão visual do Checkpoint C pega qualquer desvio |

## Open Questions

- ~~**Como medir a meta de ≥ 90% em `features/dev-tools/domain/`.**~~ **Resolvido em 2026-09-21:** você aprovou `@vitest/coverage-v8@5.0.1` (mesma versão da API) como devDependency do web, com o script `coverage`. Entra na T11, junto da medição — não antes, para não misturar dependência nova com commit de refatoração.
- **Ícones e ordem dos cards no índice** ficam a meu critério na T2 (lucide, a mesma família do resto do app) e podem mudar na revisão visual.
