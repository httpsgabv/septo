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
- [ ] Colar YAML com origem em "detectar" e destino JSON converte; o inverso volta ao YAML equivalente
- [ ] CSV → JSON e JSON → CSV funcionam com o exemplo da tabela do teste
- [ ] Erro de parse e erro de "CSV precisa de lista de objetos simples" aparecem na tela, sem quebrar o painel
- [ ] Trocar o destino reconverte a mesma entrada sem precisar colar de novo
- [ ] O bundle dos parsers não entra no chunk do índice (conferido no build)

**Verificação:**
- [ ] Manual: os quatro formatos, nos dois sentidos, com um exemplo real
- [ ] `npm run build -w @septo/web` e conferir em que chunk caíram `js-yaml`/`papaparse`/`fast-xml-parser`
- [ ] `check-types`, `lint`, `test`

**Dependências:** T5
**Arquivos:** `apps/web/src/features/dev-tools/components/data-tool.tsx`, `apps/web/src/routes/_app/dev-tools/data.tsx`
**Tamanho:** M

---

### T7: Conversor de imagens

**Descrição:** `domain/image.ts` puro: formatos de saída candidatos, `resizeTo(largura, altura, larguraMáxima)` (preserva proporção, nunca amplia), `outputFileName(nome, formato)` e o mimetype/extensão de cada formato. A tela usa o `FileDrop` (limite 25 MB), `createImageBitmap(file, { imageOrientation: 'from-image' })`, canvas e `toBlob(mimetype, qualidade)`; o suporte a WebP/AVIF é detectado encodando 1×1 e conferindo o mimetype do blob — formato sem suporte não aparece na lista. Mostra tamanho antes/depois e dimensões, baixa com `URL.createObjectURL` + `revokeObjectURL`. A linha sobre EXIF descartado (inclusive geolocalização) fica visível.

**Aceite:**
- [ ] Redimensionamento preserva proporção, arredonda para inteiro e não amplia imagem menor que o limite
- [ ] Extensão e mimetype casam com o formato; o nome de saída preserva o nome original e troca a extensão
- [ ] PNG → WebP e PNG → JPEG baixam um arquivo que abre; o tamanho antes/depois aparece
- [ ] Formato não suportado pelo navegador não é oferecido (detecção em runtime, não lista fixa)
- [ ] Arquivo acima de 25 MB ou que não seja imagem mostra aviso e não processa
- [ ] Object URL revogado depois do download

**Verificação:**
- [ ] `npm run test -w @septo/web` (`image.spec.ts`, só a parte pura)
- [ ] Manual no Chromium: PNG grande → WebP com largura máxima; conferir arquivo baixado
- [ ] `check-types`, `lint`

**Dependências:** T2 (e o `FileDrop`, da T4)
**Arquivos:** `apps/web/src/features/dev-tools/domain/image.ts` (+ spec), `apps/web/src/features/dev-tools/components/image-tool.tsx`, `apps/web/src/routes/_app/dev-tools/image.tsx`
**Tamanho:** M

---

### T8: Gerador RSA

**Descrição:** `domain/rsa.ts` com `generateRsaKeyPair(bits)` (WebCrypto: `RSASSA-PKCS1-v1_5`, SHA-256, expoente 65537, `extractable: true`) e `toPem(tipo, bytes)` → base64 em linhas de 64 colunas com os cabeçalhos `PUBLIC KEY`/`PRIVATE KEY`. A tela tem o seletor 2048/3072/4096, botão com estado "Gerando…", os dois PEM em painéis separados com `CopyButton` e botão de baixar (`.pub.pem` e `.pem`), e o aviso de que a chave foi gerada aqui, não sai da aba e some ao sair. A privada nunca vai para log, URL ou clipboard automático.

**Aceite:**
- [ ] `generateRsaKeyPair(2048)` devolve os dois PEM com cabeçalho e rodapé corretos e linhas de 64 colunas
- [ ] O PEM exportado **volta** por `crypto.subtle.importKey` (spki e pkcs8) — é o teste que prova que o PEM é válido
- [ ] Os três tamanhos são aceitos; um tamanho fora da lista é rejeitado
- [ ] Durante a geração o botão fica desabilitado em "Gerando…" e a interface responde
- [ ] Baixar gera dois arquivos com nomes distintos e revoga o Object URL
- [ ] Nenhum `console.log` nem query string com material de chave (conferido no diff)

**Verificação:**
- [ ] `npm run test -w @septo/web` (`rsa.spec.ts` escrito antes; usa `globalThis.crypto` do Node 24)
- [ ] Manual: gerar 4096 e conferir o tempo e a interface; `openssl rsa -pubin -in chave.pub.pem -text -noout` aceita a pública
- [ ] `check-types`, `lint`

**Dependências:** T2
**Arquivos:** `apps/web/src/features/dev-tools/domain/rsa.ts` (+ spec), `apps/web/src/features/dev-tools/components/rsa-tool.tsx`, `apps/web/src/routes/_app/dev-tools/rsa.tsx`
**Tamanho:** M

---

### T9: Leitor de README

**Descrição:** Tela com um `textarea` para colar markdown (e o `FileDrop` aceitando `.md`, limite 2 MB) e o resultado renderizado por um Tiptap em `editable: false`, montado com `markdownExtensions` e `parseMarkdown(texto)` do `shared/markdown.ts`. Sem HTML injetado: o ProseMirror faz o parse. A linha de limite ("tabela, checklist e imagem aparecem como texto") fica visível. Carregado com `lazy` dentro de `ClientOnly`, com skeleton — mesma receita do editor de notas.

**Aceite:**
- [ ] Markdown colado renderiza títulos, listas, citação, código, link e linha horizontal
- [ ] Tabela GFM e badge de imagem aparecem como texto, sem quebrar a página
- [ ] O conteúdo é somente leitura (não dá para editar) e o texto é selecionável/copiável
- [ ] Arquivo `.md` solto preenche a entrada
- [ ] Nenhum `dangerouslySetInnerHTML` no módulo (conferido por `grep`)
- [ ] O chunk do Tiptap não é baixado até abrir `/dev-tools/readme`

**Verificação:**
- [ ] Manual: colar o `README.md` do próprio repo e ler
- [ ] Aba Network: o chunk do editor só aparece nesta rota
- [ ] `check-types`, `lint`, `test`

**Dependências:** T1, T2
**Arquivos:** `apps/web/src/features/dev-tools/components/readme-tool.tsx`, `apps/web/src/routes/_app/dev-tools/readme.tsx`
**Tamanho:** S

---

## Fase 4: fechamento

### T10: E2E das seis ferramentas

**Descrição:** `apps/web/e2e/dev-tools.spec.ts`, autenticado com o `storageState` existente, **não** destrutivo. Um teste curto por ferramenta, mais o índice e a checagem de isolamento. Fixture: um PNG pequeno em `e2e/fixtures/`.

**Aceite:**
- [ ] Índice lista as seis e cada card navega; URL direta de uma ferramenta funciona após reload (`gotoHydrated`)
- [ ] O HTML do SSR de `/dev-tools` já traz os seis nomes (asserções provadas no smoke da T2, que foi descartado — recuperar aqui)
- [ ] A barra de ferramentas aparece nas seis rotas e fica escondida no índice
- [ ] JSON: inválido mostra linha/coluna; válido formata
- [ ] Dados: YAML colado vira JSON
- [ ] Encodings: texto com acento e emoji vai e volta do base64
- [ ] Imagem: PNG da fixture vira WebP e o download acontece (`waitForEvent('download')`, nome e tamanho conferidos)
- [ ] RSA: gerar 2048 mostra os dois PEM em menos de 10 s
- [ ] README: markdown colado renderiza `<h1>` e uma lista
- [ ] Isolamento: durante os testes, nenhuma requisição para `/api/*` e nenhuma para outra origem; `localStorage` sem chave do módulo
- [ ] Um teste em 375 px confere que o layout não tem scroll horizontal

**Verificação:**
- [ ] `npm run test:e2e -w @septo/web -- dev-tools.spec.ts`, três execuções seguidas sem flake
- [ ] `npm run test:e2e -w @septo/web` completo verde (nada regrediu em notas, sessão e shell)

**Dependências:** T9
**Arquivos:** `apps/web/e2e/dev-tools.spec.ts`, `apps/web/e2e/fixtures/sample.png`, `apps/web/e2e/helpers.ts` (se precisar de um helper)
**Tamanho:** L

---

### T11: Cobertura, README, CLAUDE.md, CAPABILITY-MAP e status da spec

**Descrição:** Fechar o módulo: medir a cobertura de `features/dev-tools/domain/` (com `@vitest/coverage-v8` no web, **se você aprovar** a devDependency — ver Open Questions do plano; sem ela, a meta fica como diretriz), atualizar o README com as ferramentas, acrescentar ao CLAUDE.md as armadilhas que aparecerem (o caminho novo do bridge markdown já entrou na T1), marcar a spec como implementada, atualizar a linha do `dev-tools` no CAPABILITY-MAP e conferir os 10 Success Criteria um a um.

**Aceite:**
- [ ] Tabela "Verificação dos Success Criteria" no fim do plano, com como cada um foi verificado
- [ ] README lista as seis ferramentas e diz que rodam no navegador
- [ ] CAPABILITY-MAP: `dev-tools` com spec, plano e ✅ implementado
- [ ] Spec com status "implementada"
- [ ] `git diff main -- apps/api` vazio (nem `openapi.json` nem código da API mudaram)
- [ ] Cobertura de `features/dev-tools/domain/` ≥ 90% de linhas (ou a decisão registrada de não medir)

**Verificação:**
- [ ] `npm run lint`, `npm run check-types`, `npm run test`, `npm run test:e2e` verdes num clone limpo (`npm ci`)
- [ ] `npm run build` com cache hit na segunda execução

**Dependências:** T10
**Arquivos:** `README.md`, `CLAUDE.md`, `CAPABILITY-MAP.md`, `specs/SPEC-dev-tools.md`, `tasks/dev-tools/plan.md`
**Tamanho:** M
