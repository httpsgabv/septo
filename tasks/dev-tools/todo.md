# Tarefas: dev-tools

> Plano: [plan.md](plan.md) · Spec: [SPEC-dev-tools](../../specs/SPEC-dev-tools.md)
> Branch: `feature/dev-tools` · um commit por tarefa (Conventional Commits, em inglês).
> Regra geral: toda tarefa termina com `npm run lint`, `npm run check-types` e `npm run test` passando (infra no ar: `docker compose up -d`).
> **Nenhuma tarefa toca `apps/api`**: sem controller, sem migration, sem `codegen`. `apps/api/openapi.json` tem que sair deste módulo idêntico.
> Tudo roda no navegador: nada de `fetch` para a API ou para terceiros, nada em `localStorage`, nada de `eval`/`new Function`/`dangerouslySetInnerHTML`.
> Parser, canvas, WebCrypto e Tiptap ficam **só** dentro do componente da ferramenta que os usa. `lazy` + `ClientOnly` apenas onde pesa no bundle ou precisa do navegador no render (README e dados); JSON, encodings, imagens e RSA renderizam no SSR normalmente (ajuste de 2026-09-21, registrado na spec).
> UI em PT-BR; código, commits e identificadores em inglês. Texto em acento usa `text-brand-text`.

---

## Fase 1: risco — o bridge compartilhado

### T1: Mover `markdown.ts` para `shared/` e renomear `noteExtensions` ⚠️ toca o `notes`

**Descrição:** `features/notes/domain/markdown.ts` e `markdown.spec.ts` vão para `shared/markdown.ts` e `shared/markdown.spec.ts` — apareceu o segundo consumidor (o leitor de README), que é a regra do CAPABILITY-MAP. O export `noteExtensions` vira `markdownExtensions` e `noteSchema` vira `markdownSchema`; o comentário do topo passa a dizer que o conjunto de formatação é compartilhado pelo editor de notas e pelo leitor de README. O único importador hoje é `features/notes/components/note-editor.tsx`. **Nenhuma mudança de comportamento**: os casos do round-trip não mudam.

**Aceite:**
- [x] `apps/web/src/shared/markdown.ts` exporta `markdownExtensions`, `markdownSchema`, `parseMarkdown`, `serializeMarkdown`
- [x] `markdown.spec.ts` foi movido junto, sem nenhum caso alterado, adicionado ou removido (o diff do spec é só o caminho do import)
- [x] `note-editor.tsx` importa de `../../../shared/markdown` e usa `markdownExtensions`
- [x] `grep -rn "domain/markdown" apps/web/src` não devolve nada
- [x] CLAUDE.md atualizado: a armadilha das notas passa a apontar para `apps/web/src/shared/markdown.ts`

**Verificação:**
- [x] `npm run test -w @septo/web` (o round-trip passa igual)
- [x] `npm run check-types` e `npm run lint`
- [x] `npm run test:e2e -w @septo/web -- notes.spec.ts` verde — abrir nota, digitar, salvar, recarregar, formatação idêntica

**Dependências:** nenhuma
**Arquivos:** `apps/web/src/shared/markdown.ts`, `apps/web/src/shared/markdown.spec.ts` (movidos), `apps/web/src/features/notes/components/note-editor.tsx`, `CLAUDE.md`
**Tamanho:** S

---

## Fase 2: casca

### T2: Layout `/dev-tools`, índice, `tools.ts`, `ToolPage` e as seis rotas stub

**Descrição:** `routes/_app/dev-tools.tsx` deixa de ser uma página e vira rota de layout, com uma barra de links entre as ferramentas no topo (escondida no índice, que já mostra os cards) e `Outlet`. `routes/_app/dev-tools/index.tsx` é o índice com um card por ferramenta (`card` do `@septo/ui`). `features/dev-tools/domain/tools.ts` é a fonte única (rota, nome, descrição, ícone lucide), consumida pelo layout e pelo índice — o mesmo padrão do `shared/navigation.ts`. `components/tool-page.tsx` dá a moldura comum: recebe só a rota (`to`), lê título e descrição do `tools.ts` via `toolFor` e imprime a linha "roda inteiro no seu navegador: nada é enviado para o servidor nem guardado ao sair". As seis rotas nascem como stub: `ToolPage` + `EmptyState` "em construção", trocadas uma a uma nas T3–T9. O título "Dev Tools" continua na tela do índice, que é o que o `shell.spec.ts` espera.

**Aceite:**
- [x] `/dev-tools` lista as seis ferramentas e cada card navega para a sua rota
- [x] `/dev-tools/json`, `/data`, `/encode`, `/image`, `/rsa` e `/readme` abrem por URL direta e por reload, dentro do layout
- [x] `tools.ts` é a única lista de ferramentas do módulo (layout e índice leem dela); tem teste que garante rota única por ferramenta
- [x] O índice renderiza no SSR (sem `ClientOnly`) e o `ToolPage` é usado pelas seis rotas
- [x] `findNavItem` continua marcando "Dev Tools" como item ativo nas sub-rotas (já trata prefixo)

**Verificação:**
- [x] `npm run test -w @septo/web`, `check-types`, `lint`
- [x] `npm run test:e2e -w @septo/web -- shell.spec.ts` verde (⌘K e sidebar levam a `/dev-tools`)
- [x] Navegar nas seis rotas em 375 px sem scroll horizontal

**Dependências:** nenhuma
**Arquivos:** `apps/web/src/routes/_app/dev-tools.tsx`, `apps/web/src/routes/_app/dev-tools/{index,json,data,encode,image,rsa,readme}.tsx` (seis stubs de ~6 linhas), `apps/web/src/features/dev-tools/domain/tools.ts` (+ spec), `apps/web/src/features/dev-tools/components/tool-page.tsx`
**Tamanho:** M

---

## Fase 3: as seis ferramentas

### T3: Formatador JSON

**Descrição:** `domain/json.ts` com `formatJson(texto, indent)`, `minifyJson(texto)` e a extração de posição do erro: a mensagem do motor (`... at position 42 (line 4 column 12)` ou só `at position 42`) vira `{ line, column, message }`, contando o texto quando o motor não der linha/coluna; sem posição nenhuma, devolve a mensagem crua. A tela é um `textarea` de entrada, os controles (2 espaços / 4 espaços / tab, Formatar, Minificar) e a saída com `CopyButton` — que nasce aqui, em `components/copy-button.tsx` (usa `navigator.clipboard`, mostra "Copiado" por 2 s, e é reusado pelas outras cinco). O limite de 2 MB é checado antes de processar. TDD: `json.spec.ts` primeiro.

**Aceite:**
- [x] Formatar com as três indentações; minificar; entrada vazia devolve vazio, não erro
- [x] JSON inválido devolve linha e coluna corretas nos três casos do teste: erro no meio, na primeira linha e no fim do texto
- [x] Mensagem sem posição cai no texto cru, sem quebrar
- [x] Texto acima de 2 MB mostra aviso e não processa
- [x] O aviso sobre precisão de inteiros acima de 2^53 aparece na tela, com `// ponytail:` no código
- [x] `CopyButton` copia a saída e dá retorno visível; acessível por teclado

**Verificação:**
- [x] `npm run test -w @septo/web` (`json.spec.ts` escrito antes)
- [x] Manual: colar um JSON quebrado e conferir que a linha/coluna apontam o lugar certo
- [x] `check-types`, `lint`

**Dependências:** T2
**Arquivos:** `apps/web/src/features/dev-tools/domain/json.ts` (+ spec), `apps/web/src/features/dev-tools/components/{json-tool,copy-button}.tsx`, `apps/web/src/routes/_app/dev-tools/json.tsx`
**Tamanho:** M

---

### T4: Encodings (base64, base64url, URL, hex) + `FileDrop`

**Descrição:** `domain/encoding.ts` com `encode`/`decode` para os quatro esquemas, sempre passando por bytes: `TextEncoder`/`TextDecoder` → `Uint8Array` → base64 (via string binária em blocos, nunca `btoa(texto)` direto). base64url sem padding e com `-`/`_`. Hex em minúsculas, tolerante a espaços na entrada. Erros de decodificação viram mensagem (`Result`-like, não exceção solta). A tela tem dois painéis (entrada/saída), o seletor de esquema e um botão de inverter o sentido. `components/file-drop.tsx` nasce aqui — área que aceita arrastar e clicar, com limite de tamanho por parâmetro — e serve para "arquivo → base64" e depois para a imagem. TDD.

**Aceite:**
- [x] "Anotação 🎉" sobrevive à ida e volta nos quatro esquemas
- [x] base64url não contém `+`, `/` nem `=`; decodifica base64 com e sem padding
- [x] Hex de tamanho ímpar e base64 com caractere inválido devolvem erro com mensagem clara
- [x] URL-encode preserva espaço e `+` de forma inequívoca (ida e volta estável)
- [x] Arquivo solto vira base64; acima do limite (2 MB aqui) mostra aviso e não processa
- [x] `FileDrop` funciona por clique e por teclado, não só arrastando

**Verificação:**
- [x] `npm run test -w @septo/web` (`encoding.spec.ts` escrito antes, com acento, emoji e bytes não-UTF-8)
- [x] Manual: colar acento e emoji, inverter o sentido e conferir
- [x] `check-types`, `lint`

**Dependências:** T2
**Arquivos:** `apps/web/src/features/dev-tools/domain/encoding.ts` (+ spec), `apps/web/src/features/dev-tools/components/{encode-tool,file-drop}.tsx`, `apps/web/src/routes/_app/dev-tools/encode.tsx`
**Tamanho:** M

---

### T5: Dependências de parser + `domain/data.ts` (JSON/YAML/CSV/XML)

**Descrição:** Instalar `js-yaml@5.4.2`, `papaparse@5.7.0`, `@types/papaparse@5.5.2` (dev) e `fast-xml-parser@5.11.1` no web, e escrever `domain/data.ts`: `detectFormat(texto)`, `parseData(texto, formato)` e `serializeData(valor, formato)`, com tudo passando por um valor JS intermediário. `js-yaml` só com `load` no schema padrão. CSV pelo papaparse, com cabeçalho na primeira linha; serializar para CSV exige lista de objetos planos e devolve erro explicativo caso contrário. XML pelo `fast-xml-parser` com `ignoreAttributes: false` (prefixo `@_`). Erro de parse vira mensagem, nunca exceção solta. **Sem UI nesta tarefa** — é aqui que qualquer briga de ESM/CJS aparece, longe da tela.

**Aceite:**
- [x] Round-trip JSON → YAML → JSON e JSON → XML → JSON preservam o valor nos casos da tabela
- [x] CSV com vírgula, aspas e quebra de linha dentro do campo sobrevive ao round-trip; cabeçalho vira as chaves
- [x] Objeto aninhado → CSV devolve erro explicativo (não achata, não inventa coluna)
- [x] `detectFormat` acerta as quatro entradas de exemplo e devolve `null` no que for ambíguo (o seletor manual sobrepõe)
- [x] YAML e XML inválidos devolvem erro com mensagem útil
- [x] Nenhum uso de schema estendido do `js-yaml` (sem `!!js/*`) — conferido no código e citado no teste
- [x] As três libs importam e rodam no Vitest em ambiente `node`

**Verificação:**
- [x] `npm run test -w @septo/web` (`data.spec.ts` escrito antes)
- [x] `npm run check-types`, `lint`; `npm ls js-yaml papaparse fast-xml-parser` limpo
- [x] Se o `papaparse` brigar com ESM: plano A/B do plano; trocar de lib **só com sua aprovação**

**Dependências:** T2
**Arquivos:** `apps/web/src/features/dev-tools/domain/data.ts` (+ spec), `apps/web/package.json`, `package-lock.json`
**Tamanho:** L

---

### T6: Tela do conversor de dados

**Descrição:** Dois painéis (entrada e saída), seletor de formato de origem com "detectar automaticamente" como padrão, seletor de destino, `CopyButton` e a linha que avisa que XML é conversão com perda e CSV precisa de lista de objetos simples. Limite de 2 MB. Os parsers são importados só neste componente (chunk da ferramenta).

**Aceite:**
- [x] Colar YAML com origem em "detectar" e destino JSON converte; o inverso volta ao YAML equivalente
- [x] CSV → JSON e JSON → CSV funcionam com o exemplo da tabela do teste
- [x] Erro de parse e erro de "CSV precisa de lista de objetos simples" aparecem na tela, sem quebrar o painel
- [x] Trocar o destino reconverte a mesma entrada sem precisar colar de novo
- [x] O bundle dos parsers não entra no chunk do índice (conferido no build)

**Verificação:**
- [x] Manual: os quatro formatos, nos dois sentidos, com um exemplo real
- [x] `npm run build -w @septo/web` e conferir em que chunk caíram `js-yaml`/`papaparse`/`fast-xml-parser`
- [x] `check-types`, `lint`, `test`

**Dependências:** T5
**Arquivos:** `apps/web/src/features/dev-tools/components/data-tool.tsx`, `apps/web/src/routes/_app/dev-tools/data.tsx`
**Tamanho:** M

---

### T7: Conversor de imagens

**Descrição:** `domain/image.ts` puro: formatos de saída candidatos, `resizeTo(largura, altura, larguraMáxima)` (preserva proporção, nunca amplia), `outputFileName(nome, formato)` e o mimetype/extensão de cada formato. A tela usa o `FileDrop` (limite 25 MB), `createImageBitmap(file, { imageOrientation: 'from-image' })`, canvas e `toBlob(mimetype, qualidade)`; o suporte a WebP/AVIF é detectado encodando 1×1 e conferindo o mimetype do blob — formato sem suporte não aparece na lista. Mostra tamanho antes/depois e dimensões, baixa com `URL.createObjectURL` + `revokeObjectURL`. A linha sobre EXIF descartado (inclusive geolocalização) fica visível.

**Aceite:**
- [x] Redimensionamento preserva proporção, arredonda para inteiro e não amplia imagem menor que o limite
- [x] Extensão e mimetype casam com o formato; o nome de saída preserva o nome original e troca a extensão
- [x] PNG → WebP e PNG → JPEG baixam um arquivo que abre; o tamanho antes/depois aparece
- [x] Formato não suportado pelo navegador não é oferecido (detecção em runtime, não lista fixa)
- [x] Arquivo acima de 25 MB ou que não seja imagem mostra aviso e não processa
- [x] Object URL revogado depois do download

**Verificação:**
- [x] `npm run test -w @septo/web` (`image.spec.ts`, só a parte pura)
- [x] Manual no Chromium: PNG grande → WebP com largura máxima; conferir arquivo baixado
- [x] `check-types`, `lint`

**Dependências:** T2 (e o `FileDrop`, da T4)
**Arquivos:** `apps/web/src/features/dev-tools/domain/image.ts` (+ spec), `apps/web/src/features/dev-tools/components/image-tool.tsx`, `apps/web/src/routes/_app/dev-tools/image.tsx`
**Tamanho:** M

---

### T8: Gerador RSA

**Descrição:** `domain/rsa.ts` com `generateRsaKeyPair(bits)` (WebCrypto: `RSASSA-PKCS1-v1_5`, SHA-256, expoente 65537, `extractable: true`) e `toPem(tipo, bytes)` → base64 em linhas de 64 colunas com os cabeçalhos `PUBLIC KEY`/`PRIVATE KEY`. A tela tem o seletor 2048/3072/4096, botão com estado "Gerando…", os dois PEM em painéis separados com `CopyButton` e botão de baixar (`.pub.pem` e `.pem`), e o aviso de que a chave foi gerada aqui, não sai da aba e some ao sair. A privada nunca vai para log, URL ou clipboard automático.

**Aceite:**
- [x] `generateRsaKeyPair(2048)` devolve os dois PEM com cabeçalho e rodapé corretos e linhas de 64 colunas
- [x] O PEM exportado **volta** por `crypto.subtle.importKey` (spki e pkcs8) — é o teste que prova que o PEM é válido
- [x] Os três tamanhos são aceitos; um tamanho fora da lista é rejeitado
- [x] Durante a geração o botão fica desabilitado em "Gerando…" e a interface responde
- [x] Baixar gera dois arquivos com nomes distintos e revoga o Object URL
- [x] Nenhum `console.log` nem query string com material de chave (conferido no diff)

**Verificação:**
- [x] `npm run test -w @septo/web` (`rsa.spec.ts` escrito antes; usa `globalThis.crypto` do Node 24)
- [x] Manual: gerar 4096 e conferir o tempo e a interface; `openssl rsa -pubin -in chave.pub.pem -text -noout` aceita a pública
- [x] `check-types`, `lint`

**Dependências:** T2
**Arquivos:** `apps/web/src/features/dev-tools/domain/rsa.ts` (+ spec), `apps/web/src/features/dev-tools/components/rsa-tool.tsx`, `apps/web/src/routes/_app/dev-tools/rsa.tsx`
**Tamanho:** M

---

### T9: Leitor de README

**Descrição:** Tela com um `textarea` para colar markdown (e o `FileDrop` aceitando `.md`, limite 2 MB) e o resultado renderizado por um Tiptap em `editable: false`, montado com `markdownExtensions` e `parseMarkdown(texto)` do `shared/markdown.ts`. Sem HTML injetado: o ProseMirror faz o parse. A linha de limite ("tabela, checklist e imagem aparecem como texto") fica visível. Carregado com `lazy` dentro de `ClientOnly`, com skeleton — mesma receita do editor de notas.

**Aceite:**
- [x] Markdown colado renderiza títulos, listas, citação, código, link e linha horizontal
- [x] Tabela GFM e badge de imagem aparecem como texto, sem quebrar a página
- [x] O conteúdo é somente leitura (não dá para editar) e o texto é selecionável/copiável
- [x] Arquivo `.md` solto preenche a entrada
- [x] Nenhum `dangerouslySetInnerHTML` no módulo (conferido por `grep`)
- [x] O chunk do Tiptap não é baixado até abrir `/dev-tools/readme`

**Verificação:**
- [x] Manual: colar o `README.md` do próprio repo e ler
- [x] Aba Network: o chunk do editor só aparece nesta rota
- [x] `check-types`, `lint`, `test`

**Dependências:** T1, T2
**Arquivos:** `apps/web/src/features/dev-tools/components/readme-tool.tsx`, `apps/web/src/routes/_app/dev-tools/readme.tsx`
**Tamanho:** S

---

## Fase 4: fechamento

### T10: E2E das seis ferramentas

**Descrição:** `apps/web/e2e/dev-tools.spec.ts`, autenticado com o `storageState` existente, **não** destrutivo. Um teste curto por ferramenta, mais o índice e a checagem de isolamento. Fixture: um PNG pequeno em `e2e/fixtures/`.

**Aceite:**
- [x] Índice lista as seis e cada card navega; URL direta de uma ferramenta funciona após reload (`gotoHydrated`)
- [x] O HTML do SSR de `/dev-tools` já traz os seis nomes (asserções provadas no smoke da T2, que foi descartado — recuperar aqui)
- [x] A barra de ferramentas aparece nas seis rotas e fica escondida no índice
- [x] JSON: inválido mostra linha/coluna; válido formata
- [x] Dados: YAML colado vira JSON
- [x] Encodings: texto com acento e emoji vai e volta do base64
- [x] Imagem: PNG da fixture vira WebP e o download acontece (`waitForEvent('download')`, nome e tamanho conferidos)
- [x] RSA: gerar 2048 mostra os dois PEM em menos de 10 s
- [x] README: markdown colado renderiza `<h1>` e uma lista
- [x] Isolamento: durante os testes, nenhuma requisição para `/api/*` e nenhuma para outra origem; `localStorage` sem chave do módulo
- [x] Um teste em 375 px confere que o layout não tem scroll horizontal

**Verificação:**
- [x] `npm run test:e2e -w @septo/web -- dev-tools.spec.ts`, três execuções seguidas sem flake
- [x] `npm run test:e2e -w @septo/web` completo verde (nada regrediu em notas, sessão e shell)

**Dependências:** T9
**Arquivos:** `apps/web/e2e/dev-tools.spec.ts`, `apps/web/e2e/fixtures/sample.png`, `apps/web/e2e/helpers.ts` (se precisar de um helper)
**Tamanho:** L

---

### T11: Cobertura, README, CLAUDE.md, CAPABILITY-MAP e status da spec

**Descrição:** Fechar o módulo: medir a cobertura de `features/dev-tools/domain/` (com `@vitest/coverage-v8` no web, **se você aprovar** a devDependency — ver Open Questions do plano; sem ela, a meta fica como diretriz), atualizar o README com as ferramentas, acrescentar ao CLAUDE.md as armadilhas que aparecerem (o caminho novo do bridge markdown já entrou na T1), marcar a spec como implementada, atualizar a linha do `dev-tools` no CAPABILITY-MAP e conferir os 10 Success Criteria um a um.

**Aceite:**
- [x] Tabela "Verificação dos Success Criteria" no fim do plano, com como cada um foi verificado
- [x] README lista as seis ferramentas e diz que rodam no navegador
- [x] CAPABILITY-MAP: `dev-tools` com spec, plano e ✅ implementado
- [x] Spec com status "implementada"
- [x] `git diff main -- apps/api` vazio (nem `openapi.json` nem código da API mudaram)
- [x] Cobertura de `features/dev-tools/domain/` ≥ 90% de linhas (ou a decisão registrada de não medir)

**Verificação:**
- [x] `npm run lint`, `npm run check-types`, `npm run test`, `npm run test:e2e` verdes num clone limpo (`npm ci`)
- [x] `npm run build` com cache hit na segunda execução

**Dependências:** T10
**Arquivos:** `README.md`, `CLAUDE.md`, `CAPABILITY-MAP.md`, `specs/SPEC-dev-tools.md`, `tasks/dev-tools/plan.md`
**Tamanho:** M

---

# Revisão 1: navegação e layout

> Plano: [plan.md § Revisão 1](plan.md#revisão-1-navegação-e-layout) · Spec: [SPEC-dev-tools § Revisão 1](../../specs/SPEC-dev-tools.md#revisão-1-navegação-e-layout)
> Branch: `feat/dev-tools-layout` · um commit por tarefa. Mesmas regras do módulo: nada em `apps/api`, nada de rede, nada em `localStorage`. **Nenhum `domain/*.ts` muda de comportamento.**
> Toda tarefa termina com `npm run lint`, `npm run check-types`, `npm run test` e o e2e da tela tocada (`npm run test:e2e -w @septo/web -- <arquivo>`) verdes.

### R1: Ferramentas como subitens na sidebar e no ⌘K

**Descrição:** "Dev Tools" continua link para o índice e ganha um chevron (`SidebarMenuAction`) que expande um `SidebarMenuSub` com as seis ferramentas (ícone + nome). Aberto por padrão dentro de `/dev-tools/*`, fechado fora; reabre ao entrar numa ferramenta. A paleta ganha o grupo "Dev Tools" com as seis (descrição como `keywords`). A barra "Ferramentas" de `dev-tools.tsx` sai: o layout vira só `Outlet`.

**Aceite:**
- [x] `navigation.ts`: `NavItem` com `children?`; Dev Tools tem as seis a partir de `tools.ts`
- [x] Chevron com `aria-expanded` e rótulo "Mostrar ferramentas"/"Ocultar ferramentas"; subitem ativo com `data-active`; pai continua ativo em `/dev-tools/json`
- [x] Clicar num subitem fecha o drawer no mobile
- [x] Reload em `/dev-tools/rsa` renderiza o grupo aberto no HTML do servidor (sem aviso de hidratação no console)
- [x] ⌘K → "rsa" + Enter leva a `/dev-tools/rsa`
- [x] `dev-tools.tsx` sem `<nav>`

**Verificação:**
- [x] `navigation.spec.ts`: `findNavItem('/dev-tools/json')` devolve Dev Tools; as seis crianças batem com `tools`
- [x] `shell.spec.ts`: novo teste de expandir/recolher, subitem navega e fica ativo; paleta acha "rsa"
- [x] `dev-tools.spec.ts`: testes da barra "Ferramentas" trocados por navegação pela sidebar; cliques escopados por região

**Dependências:** nenhuma
**Arquivos:** `shared/navigation.ts`, `shared/navigation.spec.ts`, `shared/layout/app-sidebar.tsx`, `shared/layout/command-palette.tsx`, `routes/_app/dev-tools.tsx`, `e2e/shell.spec.ts`, `e2e/dev-tools.spec.ts`
**Tamanho:** M

### R2: Moldura `Workspace` + índice compacto + JSON ao vivo

**Descrição:** Novo `components/workspace.tsx` com `Workspace` (toolbar `h-12` com ícone + `<h1>` à esquerda e `toolbar` à direita; corpo que preenche `md:h-[calc(100dvh-3rem)]`; `status` opcional no rodapé), `Pane` (cabeçalho de 36 px com `<label>` em caixa-alta + `actions`; corpo sem borda) e `StatusBar`. Novo `components/segmented.tsx` (o markup de rádio que hoje está copiado). `CopyButton` ganha tamanho compacto (ícone + rótulo `sr-only` quando `iconOnly`). Índice: grade de blocos ícone + nome, sem descrição da página. JSON migrado: formata ao digitar; seletor `2 · 4 · Tab · Min`; erro na status bar; sem os botões e sem o rodapé do 2^53.

**Aceite:**
- [x] `routes/_app/dev-tools/json.tsx` renderiza só `<JsonTool />`
- [x] Digitar `{"a":1}` mostra a saída formatada sem clicar em nada; `Min` minifica
- [x] JSON quebrado mostra "Linha 3, coluna 8: …" na status bar, com `aria-live="polite"`
- [x] Índice sem `description`; cada bloco é um link com ícone + nome
- [x] Em 1440×900, `/dev-tools/json` não tem scroll de página
- [x] O texto "Roda inteiro no seu navegador" não existe mais no código

**Verificação:**
- [x] `dev-tools.spec.ts`: teste do JSON reescrito (sem Formatar/Minificar); índice sem descrição
- [x] Olhar no navegador em claro/escuro e em 375 px

**Dependências:** R1
**Arquivos:** `components/workspace.tsx` (novo), `components/segmented.tsx` (novo), `components/copy-button.tsx`, `components/json-tool.tsx`, `routes/_app/dev-tools/json.tsx`, `routes/_app/dev-tools/index.tsx`, `e2e/dev-tools.spec.ts`
**Tamanho:** M

### R3: Dados e Encodings na moldura

**Descrição:** Os dois são texto → texto: `Workspace` + dois `Pane`. Dados: seletores origem → destino na toolbar via `Segmented`; XML com `title="Conversão com perda"`; erro na status bar; rodapé CSV/XML removido. Encodings: esquema e direção ("Inverter") na toolbar; o `FileDrop` de arquivo → base64 vira ação "Arquivo" no cabeçalho do painel de texto. A rota `data.tsx` usa `<Workspace to="/dev-tools/data" />` como `fallback` do `ClientOnly`/`Suspense`.

**Aceite:**
- [x] Nenhum `<p>` de rodapé em `data-tool.tsx` e `encode-tool.tsx`; `Picker` local apagado
- [x] `<h1>Dados</h1>` presente no HTML do servidor
- [x] Rótulos "Entrada"/"Saída"/"Texto"/"Codificado" e o botão "Inverter" preservados

**Verificação:**
- [x] Testes de Dados e Encodings do `dev-tools.spec.ts` passam sem mudança (ou só no seletor do arquivo)

**Dependências:** R2
**Arquivos:** `components/data-tool.tsx`, `components/encode-tool.tsx`, `routes/_app/dev-tools/data.tsx`, `routes/_app/dev-tools/encode.tsx`, `e2e/dev-tools.spec.ts`
**Tamanho:** M

### R4: Imagens e README na moldura; `FileDrop` como painel

**Descrição:** `FileDrop` ganha `className`/`children` para ocupar o painel inteiro (a borda tracejada aparece só ao arrastar). Imagens: painel da esquerda = origem (solta/clica; depois mostra a miniatura e as dimensões), painel da direita = resultado com "Baixar" no cabeçalho; formato, largura máxima e qualidade na toolbar; tamanho antes → depois na status bar; aviso de EXIF removido. README: painel "Markdown" (textarea que também aceita soltar `.md`) e painel "Leitura"; rodapé removido; `fallback` do `ClientOnly` = `Workspace` vazio.

**Aceite:**
- [x] Soltar um arquivo em qualquer ponto do painel de entrada funciona nas duas ferramentas; clicar ainda abre o seletor (Tab + Enter também)
- [x] Status bar da imagem mostra "400×250 · 12 KB → 200×125 · 3 KB" (formato equivalente)
- [x] Nenhum rodapé nos dois componentes

**Verificação:**
- [x] Testes de Imagens e README do `dev-tools.spec.ts` verdes (ajustar só seletor de região se mudar)

**Dependências:** R2
**Arquivos:** `components/file-drop.tsx`, `components/image-tool.tsx`, `components/readme-tool.tsx`, `routes/_app/dev-tools/image.tsx`, `routes/_app/dev-tools/readme.tsx`
**Tamanho:** M

### R5: RSA na moldura

**Descrição:** Tamanho (`Segmented`) e "Gerar par de chaves" na toolbar; os dois PEM como `Pane` lado a lado com Copiar/Baixar no cabeçalho; antes de gerar, os painéis mostram só o placeholder. Rodapé removido.

**Aceite:**
- [x] Botão continua "Gerando…" durante a geração; erro vai para a status bar
- [x] Rótulos "Chave pública (SPKI)" e "Chave privada (PKCS#8)" preservados

**Verificação:**
- [x] Teste de RSA do `dev-tools.spec.ts` verde sem mudança

**Dependências:** R2
**Arquivos:** `components/rsa-tool.tsx`, `routes/_app/dev-tools/rsa.tsx`
**Tamanho:** S

### R6: Fechamento

**Descrição:** Apagar `tool-page.tsx` (sem consumidores). e2e de layout: para cada ferramenta, 1440×900 sem scroll vertical de página e 375 px sem scroll horizontal. Conferir os critérios 1–7 da revisão 1. Atualizar a spec (Estrutura, Testes, status "implementada"), o CLAUDE.md (armadilha: "a ferramenta monta a própria `Workspace`; rota `lazy` usa `Workspace` vazio como fallback"; "sem textos de apoio fixos") e o README se citar a barra.

**Aceite:**
- [x] `grep -rn "ToolPage\|Roda inteiro" apps/web/src` vazio
- [x] `apps/api/openapi.json` sem diff
- [x] Build do índice sem Tiptap/parsers (o e2e existente confere)

**Verificação:**
- [x] `npm run lint`, `npm run check-types`, `npm run test`, `npm run test:e2e -w @septo/web` verdes

**Dependências:** R3, R4, R5
**Arquivos:** `components/tool-page.tsx` (apagado), `e2e/dev-tools.spec.ts`, `specs/SPEC-dev-tools.md`, `CLAUDE.md`, `README.md`
**Tamanho:** S

---

# Revisão 2: editor de código e leitura expandida

> Plano: [plan.md § Revisão 2](plan.md#revisão-2-editor-de-código-e-leitura-expandida) · Spec: [SPEC-dev-tools § Revisão 2](../../specs/SPEC-dev-tools.md#revisão-2-editor-de-código-e-leitura-expandida)
> Branch: `feat/dev-tools-editor` (a partir da `main`) · um commit por tarefa. Mesmas regras do módulo: nada em `apps/api`, nada de rede, nada em `localStorage`.
> Toda tarefa termina com `npm run lint`, `npm run check-types`, `npm run test` e `npm run test:e2e -w @septo/web -- dev-tools.spec.ts` verdes (Node ≥ 24.7).

### E1: `CodeEditor` + JSON

**Descrição:** Instalar as dependências do CodeMirror (versões fixas da tabela da spec). Criar `code-editor.tsx` (view, compartments, tema com variáveis CSS, extensões, `indentWithTab`, `aria-labelledby`, drop de arquivo recusado, linguagens por `import()`) e `lazy-code-editor.tsx` (`ClientOnly` + `lazy` + `<pre>` de fallback). `Pane` ganha `labelId`. `domain/json.ts` ganha `jsonDiagnostic`. JSON: entrada e saída no editor, com linter na entrada.

**Aceite:**
- [x] `{` + `Enter` + `Tab` + `"a": 1` no JSON dá o texto indentado, com `}` fechado e o foco no editor
- [x] `Esc` + `Tab` tira o foco do editor
- [x] JSON quebrado: `.cm-lintRange-error` na posição, com a mesma linha/coluna da status bar
- [x] `getByLabel('Entrada')` e `getByLabel('Saída')` acham os editores
- [x] A saída é só leitura (digitar não muda nada) e o Copiar funciona
- [x] Núcleo do CM medido no build: ≤ 120 KB gz (número anotado no commit; se passar, **paro e reporto**)
- [x] `/dev-tools/json` continua com `<h1>` e toolbar no HTML do servidor

**Verificação:**
- [x] Unit: `jsonDiagnostic` (erro no meio, na primeira linha, no fim; válido e vazio devolvem `null`)
- [x] e2e: teste do JSON reescrito com `editorText`; teste novo de `Tab`/`Esc`
- [x] Screenshots claro/escuro do JSON

**Dependências:** nenhuma
**Arquivos:** `apps/web/package.json` (+ lockfile), `components/code-editor.tsx` (novo), `components/lazy-code-editor.tsx` (novo), `components/workspace.tsx`, `components/json-tool.tsx`, `domain/json.ts` (+ spec), `e2e/dev-tools.spec.ts`, `e2e/helpers.ts`
**Tamanho:** L (é a fatia que prova o padrão; as próximas são M/S)

### E2: Dados + Encodings

**Descrição:** Dados: entrada com a linguagem do formato detectado ou escolhido (CSV = `null`) e saída com a do destino. Encodings: entrada e saída em texto puro; o painel "Arquivo" (arquivo carregado) não muda.

**Aceite:**
- [x] YAML colado ganha cores de YAML e a saída JSON cores de JSON; trocar o destino para XML troca as cores
- [x] O parser de YAML só é baixado quando o formato é YAML
- [x] Encodings: `Tab` indenta, "Inverter" continua trocando entrada e saída, e o arquivo continua virando base64

**Verificação:**
- [x] e2e de Dados e Encodings passando com `editorText`

**Dependências:** E1
**Arquivos:** `components/data-tool.tsx`, `components/encode-tool.tsx`, `e2e/dev-tools.spec.ts`
**Tamanho:** M

### E3: RSA + entrada do README

**Descrição:** RSA: as duas chaves no editor só leitura, em texto puro, com Copiar e Baixar no cabeçalho. README: entrada no editor com markdown; soltar um `.md` no painel substitui o conteúdo uma vez só (o CM recusa o drop e o `FileDrop` trata).

**Aceite:**
- [x] O PEM público e o privado aparecem nos editores, e o download continua com o nome `chave.pub.pem`
- [x] Soltar um `.md` no editor do README substitui o conteúdo (a guarda contra o drop do CM não é distinguível por e2e: sem ela o resultado final também é o do arquivo)
- [x] A leitura continua renderizando `<h1>`, lista e tabela como texto

**Verificação:**
- [x] e2e do RSA e do README com `editorText`, mais um teste novo de drop de `.md` (`dispatchEvent('drop')` com `DataTransfer`)

**Dependências:** E1
**Arquivos:** `components/rsa-tool.tsx`, `components/readme-tool.tsx`, `e2e/dev-tools.spec.ts`
**Tamanho:** M

### E4: README — leitura expandida

**Descrição:** Botão "Expandir" no cabeçalho do painel "Leitura". Expandido, o mesmo nó cobre a janela (`fixed inset-0 z-50`) com o texto em `max-w-3xl` centralizado e um botão "Fechar"; `Esc` também fecha e o foco volta ao "Expandir". O `Pane` ganha `expanded`/`onCollapse`, ou a própria ferramenta aplica as classes, o que der menos código.

**Aceite:**
- [x] Expandido: a caixa da leitura mede a viewport inteira; sidebar e header ficam cobertos
- [x] `role="dialog"`, `aria-modal="true"` e nome "Leitura" enquanto expandido
- [x] `Esc` e "Fechar" voltam, com o foco no "Expandir" e o mesmo conteúdo
- [x] Em 375 px também cobre a tela e rola por dentro

**Verificação:**
- [x] e2e novo: expandir, conferir `boundingBox` = viewport, `Esc`, conferir o foco

**Dependências:** E3 (mesmo arquivo)
**Arquivos:** `components/readme-tool.tsx`, `components/workspace.tsx` (se o `Pane` ganhar o modo), `e2e/dev-tools.spec.ts`
**Tamanho:** S

### E5: Fechamento

**Descrição:** Apagar `PaneTextarea` (sem consumidores). e2e de bundle: o índice e Imagens não baixam chunk do CM, e o `lang-yaml` só aparece no Dados. Screenshots das cinco ferramentas com editor, em claro/escuro e em 375 px. Atualizar a spec (Estrutura, Testes, dependências, status "implementada") e o CLAUDE.md (armadilhas: `CodeEditor` via `lazy-code-editor`; rótulo por `aria-labelledby`; e2e lê o editor com `editorText`, não `toHaveValue`; o CM recusa drop de arquivo; linguagens por `import()`).

**Aceite:**
- [x] `grep -rn "PaneTextarea\|<textarea\|Textarea" apps/web/src/features/dev-tools` vazio
- [x] `openapi.json` sem diff

**Verificação:**
- [x] `npm run lint`, `npm run check-types`, `npm run test`, `npm run test:e2e -w @septo/web` verdes

**Dependências:** E2, E3, E4
**Arquivos:** `components/workspace.tsx`, `e2e/dev-tools.spec.ts`, `specs/SPEC-dev-tools.md`, `CLAUDE.md`
**Tamanho:** S
