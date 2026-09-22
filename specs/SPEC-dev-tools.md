# Spec: dev-tools

> Módulo `dev-tools` do [CAPABILITY-MAP](../CAPABILITY-MAP.md). Status: **implementada** (aprovada em 2026-09-21). Plano: [tasks/dev-tools/plan.md](../tasks/dev-tools/plan.md).
> Herda as convenções globais de [SPEC-foundation](SPEC-foundation.md): camadas, estilo, testes e limites. Depende **só** do `foundation` (roda em paralelo ao `notes`/`reminders`), mas as rotas ficam sob o shell autenticado `_app`, ou seja, atrás do guard do [SPEC-identity](SPEC-identity.md). Aqui fica só o que é específico do módulo.

## Objetivo

Trazer para o septo o punhado de ferramentas de bolso que hoje me fazem abrir um site aleatório e colar dados meus nele: formatar um JSON, converter YAML em JSON, passar um texto por base64, reduzir uma imagem, gerar um par de chaves RSA e ler um README com calma. Tudo **100% no navegador** — nada é enviado para a API nem para terceiros, e nada fica guardado.

Sucesso = quando eu precisar de qualquer uma dessas seis coisas, abro `/dev-tools`, resolvo em poucos segundos e fecho a aba sabendo que o conteúdo não sobrou em lugar nenhum.

### Histórias

1. Em `/dev-tools` vejo as ferramentas em cards, com nome e uma linha de descrição, e abro qualquer uma com um clique (ou pelo ⌘K).
2. Colo um JSON bagunçado, escolho a indentação e vejo formatado; se estiver quebrado, a mensagem me diz **linha e coluna** do erro em vez de "Unexpected token".
3. Colo um YAML e escolho "JSON" como destino — e o contrário também: JSON, YAML, CSV e XML se convertem entre si.
4. Colo um texto com acento e emoji e ele vai e volta de base64, base64url, URL-encode e hex sem se corromper. Arrasto um arquivo e recebo o base64 dele.
5. Solto um PNG de 4 MB, escolho WebP e uma largura máxima, e baixo a imagem convertida — sem upload.
6. Gero um par RSA de 2048/3072/4096 bits, vejo a pública e a privada em PEM, e copio ou baixo cada uma. A tela avisa que a chave foi gerada aqui e some quando eu sair.
7. Colo (ou solto) um README.md e leio renderizado, em vez de ler markdown cru.
8. Abro `/dev-tools/rsa` direto pela URL e funciona: cada ferramenta tem seu link.

### Fora de escopo (v1)

Histórico ou favoritos de conversões, qualquer persistência (nem `localStorage`), buscar README por URL do GitHub (exigiria proxy no servidor — este módulo não tem backend), JSONPath/filtro/diff de JSON, árvore navegável de JSON, decodificar JWT, validar contra JSON Schema, chaves EC/ed25519, formato OpenSSH (`ssh-rsa …`), CSR/certificado, cifrar/assinar com a chave gerada, proteger a privada com senha (PKCS#8 cifrado), OCR/HEIC/RAW nas imagens, corte e rotação de imagem, conversão em lote, destaque de sintaxe no README e qualquer coisa que dependa da API.

## Revisão 1: navegação e layout

> Status: **implementada** (aprovada em 2026-09-21). Plano e tarefas: seção "Revisão 1" de [plan.md](../tasks/dev-tools/plan.md) e [todo.md](../tasks/dev-tools/todo.md). Substitui as linhas marcadas com ↻ nas Decisões, na Estrutura e nos Testes. Nada muda no domínio (`domain/*.ts`), nas dependências nem na ausência de API.

### Objetivo

Chegar a qualquer ferramenta em um clique de qualquer lugar do app, e dar a cada ferramenta a tela inteira: menos texto, mais área de trabalho.

### Histórias

1. No menu lateral, "Dev Tools" continua sendo um link para o índice, e ganha um chevron que expande as seis ferramentas como subitens (ícone + nome). Clico num subitem e vou direto para a ferramenta.
2. Dentro de `/dev-tools/*` o grupo já vem expandido e o subitem da ferramenta aberta fica ativo; fora dele vem recolhido. Posso recolher/expandir à mão.
3. Com a sidebar em modo ícone, "Dev Tools" é só o ícone (leva ao índice); no mobile (drawer) os subitens aparecem e fecham o drawer ao navegar.
4. Cada ferramenta abre como um **workspace**: uma barra fina no topo (ícone + nome à esquerda, controles da ferramenta à direita) e, abaixo, os painéis ocupando toda a largura e a altura restante da janela.
5. Não há mais descrição, aviso de "roda no seu navegador" nem nota de rodapé em nenhuma tela.

### Layout proposto

```
┌ sidebar ────────┬─ header (h-12) ────────────────────────────────── ⌘K ┐
│ ▸ Notas         │ {} JSON                [2 · 4 · Tab · Min]           │  ← toolbar (h-12, border-b)
│ ▾ Dev Tools     ├──────────────────────────────┬───────────────────────┤
│   {} JSON  ●    │ ENTRADA              limpar  │ SAÍDA          copiar │  ← cabeçalho do painel
│   ⇄ Dados       │                              │                       │
│   01 Encodings  │  textarea mono, sem borda,   │  somente leitura      │
│   ▢ Imagens     │  preenche o painel           │                       │
│   ⚿ Chaves RSA  │                              │                       │
│   ▤ README      ├──────────────────────────────┴───────────────────────┤
│                 │ ● Linha 4, coluna 12: esperava ','      1,2 KB → 980 B│  ← status bar (só quando há o quê)
└─────────────────┴──────────────────────────────────────────────────────┘
```

- **Workspace de altura cheia** (`md+`): `h-[calc(100dvh-3rem)]`, dois painéis lado a lado separados por uma linha (`divide-x`), sem cartões nem bordas duplas — estilo editor (Linear/Raycast). Abaixo de `md` os painéis empilham com altura mínima e a página rola.
- **Painel** = cabeçalho de 36 px (rótulo em caixa-alta pequena `text-xs text-muted-foreground` + ações: copiar, baixar, limpar) + área de texto sem borda própria. Um componente só (`Pane`) para as seis ferramentas.
- **Toolbar**: os controles saem do corpo da página e vão para a direita da barra da ferramenta, como segmented controls compactos (o `Picker` que hoje está copiado em quatro arquivos vira um `Segmented` único).
- **Status bar**: erro (vermelho, com linha/coluna no JSON) e métricas (tamanho antes/depois na imagem). Some quando não há nada a dizer.
- **Sem botões de ação onde dá para ser ao vivo**: o JSON passa a formatar enquanto digito, como o conversor de dados já faz; "Minificar" vira a opção `Min` do seletor de indentação. O RSA mantém o botão "Gerar" (4096 leva segundos).
- **Estados vazios**: o placeholder do textarea é a única instrução. Imagem e README: o painel de entrada inteiro é a área de soltar arquivo (clique ou arraste), sem caixa tracejada separada.
- **Índice** (`/dev-tools`): título "Dev Tools" e uma grade de blocos compactos (ícone + nome, sem descrição), 2 colunas no mobile e 3 no desktop. A descrição de cada ferramenta fica só como `keywords` no ⌘K.
- **⌘K**: as seis ferramentas entram na paleta (grupo "Dev Tools"), já que agora são itens de navegação.

### Decisões (revisão 1)

| Tema | Decisão | Por quê |
|---|---|---|
| Navegação | A barra "Ferramentas" no topo do layout **sai**: a sidebar (e o drawer no mobile) é o único seletor. `dev-tools.tsx` volta a ser só `Outlet` | Duas navegações para o mesmo destino. A barra ainda custava uma faixa de altura no workspace |
| Submenu | `SidebarMenuAction` (chevron) + `SidebarMenuSub` que já existem em `@septo/ui`; o estado aberto/fechado é `useState` inicializado pela rota, sem cookie | Zero componente novo no design system. Lembrar entre reloads não vale um cookie: a rota já decide o caso comum |
| Fonte da lista | `tools.ts` continua a fonte única; `navigation.ts` ganha `children` no item "Dev Tools" montado a partir dela | Sidebar, paleta e índice leem a mesma lista |
| Textos de apoio | Saem: descrição do índice, descrição e aviso do `ToolPage`, e os quatro rodapés (2^53, CSV/XML, RSA, README). O que importa aparece **quando importa**: o erro de CSV já explica o limite; XML ganha `title` na opção ("conversão com perda") | Pedido explícito: texto fixo que ninguém relê é ruído |
| Largura | Sem `max-w-*` nas ferramentas; o índice mantém o `Page` | As ferramentas são dois painéis; largura é justamente o recurso escasso |

### Critérios de sucesso (revisão 1)

1. Clicar em "Dev Tools" na sidebar abre o índice; o chevron expande seis subitens; clicar em "JSON" abre `/dev-tools/json` com o subitem ativo (`data-active`) e o item pai também ativo.
2. Recarregar em `/dev-tools/rsa` renderiza o grupo expandido já no SSR (sem piscar).
3. `grep -rn "Roda inteiro\|nada é enviado" apps/web/src` não devolve nada; nenhuma ferramenta tem parágrafo de rodapé.
4. Em 1440×900 os painéis vão do fim da toolbar até o fim da janela sem scroll da página; em 375 px não há scroll horizontal e tudo continua alcançável.
5. JSON formata ao digitar; `Min` minifica; um erro aparece na status bar com linha e coluna.
6. ⌘K → "rsa" leva a `/dev-tools/rsa`.
7. `dev-tools.spec.ts` e `shell.spec.ts` atualizados (navegação pela sidebar em vez da barra) e verdes; `lint`, `check-types`, `test` passam; `openapi.json` não muda; bundle do índice continua sem Tiptap/parsers.

## Revisão 2: editor de código e leitura expandida

> Status: **implementada** (aprovada em 2026-09-21, com o editor estendido a Encodings, README e RSA). A revisão 1 já está na `main` (PR #6). Branch: `feat/dev-tools-editor`, criada a partir da `main`.

### Objetivo

1. Escrever à mão em qualquer painel de texto das ferramentas (**JSON**, **Dados**, **Encodings**, **README** e **RSA**) como num editor de IDE. Hoje o `Tab` tira o foco do campo em vez de indentar, e não há números de linha, cores nem fechamento de chaves.
2. Ler um README com a janela inteira, sem painel de markdown, sem sidebar e sem header, e voltar com um clique ou `Esc`. **Não** é a Fullscreen API do navegador.

### Histórias

1. Nos painéis de **entrada** do JSON, do Dados, do Encodings e do README digito num editor com:
   - números de linha e destaque de sintaxe (JSON, YAML, XML e markdown; CSV, texto do Encodings e base64/hex ficam sem cores);
   - fechamento automático de `{ [ " '`, destaque do par e dobra de blocos;
   - `Tab`/`Shift+Tab` indentando e desindentando, e `Enter` mantendo a indentação;
   - desfazer/refazer e busca com `⌘F`.
2. No JSON, o erro de sintaxe ganha um sublinhado vermelho na posição exata (a mesma linha/coluna que a status bar já mostra), sem precisar olhar para baixo.
3. Os painéis de **saída** (JSON, Dados, Encodings e as duas chaves do RSA) usam o mesmo editor em modo somente leitura: mesmas cores, números de linha e dobra. Copiar e Baixar continuam no cabeçalho. O painel "Leitura" do README continua sendo o Tiptap renderizado.
4. No Dados, as cores seguem o formato: o detectado (ou o escolhido) na entrada e o de destino na saída.
5. Continuo conseguindo sair do editor pelo teclado: `Esc` e depois `Tab` passa o foco adiante, que é o padrão do CodeMirror para não prender o foco.
6. No README, o cabeçalho do painel "Leitura" tem um botão **Expandir**. A leitura passa a cobrir a janela inteira, com o texto numa coluna centralizada (`max-w-3xl`) e um botão **Fechar** no canto. `Esc` também fecha e devolve o foco ao botão Expandir. O markdown continua o mesmo ao voltar.

### Decisões (revisão 2)

| Tema | Decisão | Por quê |
|---|---|---|
| Editor | **CodeMirror 6** (`@codemirror/*`), não Monaco | O Monaco é o editor do VS Code: ~2 MB, com web workers e loader próprio, muito para duas ferramentas de bolso. O CM6 é modular (só entra o que usamos), acessível, funciona com teclado virtual no mobile e tem pacotes oficiais para JSON, YAML e XML |
| Integração com React | Um componente próprio `CodeEditor` (~60 linhas: cria o `EditorView` num `ref`, sincroniza `value` e `onChange`, e troca linguagem e `readOnly` por `Compartment`), **sem** `@uiw/react-codemirror` | Uma dependência a menos para o que é um `useEffect`. O wrapper também puxaria o `basicSetup` inteiro e temas próprios |
| Extensões | `lineNumbers`, `foldGutter`, `history`, `drawSelection`, `indentOnInput`, `bracketMatching`, `closeBrackets`, `highlightActiveLine`, `highlightSelectionMatches`, busca e o keymap padrão + `indentWithTab`. Sem autocomplete | É o "editor de IDE" útil para colar e ajustar dados. Autocomplete sem schema só atrapalha |
| Tab | `indentWithTab`; `Esc` seguido de `Tab` sai do editor (comportamento nativo do CM6) | Resolve o problema relatado sem criar uma armadilha de foco (WCAG 2.1.2) |
| Tema | Um tema do CM escrito com as **variáveis CSS do app** (`--background`, `--foreground`, `--muted-foreground`, `--brand-text`, `--border`) e cores de sintaxe via `HighlightStyle` também em variáveis | Segue claro/escuro e a cor de destaque sem duplicar paleta. Nada de `@uiw/codemirror-themes` |
| Erro inline no JSON | `@codemirror/lint` com um linter que chama o **nosso** `describeJsonProblem`/`findSyntaxErrorIndex` e marca 1 caractere na posição | A fonte da posição continua uma só (a status bar e o sublinhado nunca discordam) |
| Carregamento | `CodeEditor` fica num chunk `lazy` próprio, com um `<pre>` monoespaçado do mesmo valor como fallback, dentro de `ClientOnly`. JSON, Encodings e RSA continuam renderizando no SSR (moldura, toolbar e painéis); só o editor chega depois. **Cada linguagem é um `import()` à parte**, carregado quando o painel precisa dela e aplicado por `Compartment` | O CM precisa do DOM. Índice e Imagens não baixam o CM; Encodings e RSA baixam só o núcleo (texto puro); o parser de YAML ou de markdown só chega onde é usado. O e2e de bundle confere isso |
| Acessibilidade | O `contenteditable` do CM recebe `aria-labelledby` apontando para o rótulo do painel ("Entrada"/"Saída") | O `<label htmlFor>` não funciona com `contenteditable`. Assim o `getByLabel('Entrada')` e os leitores de tela continuam iguais |
| Onde usar | Todos os painéis de texto: JSON e Dados (entrada e saída), Encodings (entrada e saída, texto puro), README (entrada, markdown) e RSA (as duas chaves, só leitura, texto puro). `PaneTextarea` sai do código | Pedido do usuário em 2026-09-21: o mesmo comportamento de teclado e o mesmo visual em todas as ferramentas |
| Soltar arquivo no editor | O `CodeEditor` recusa o drop de **arquivo** do próprio CM (`domEventHandlers.drop` devolve `true` quando há `files`), e o `FileDrop` em volta (README) recebe o arquivo como hoje, com a checagem de tamanho | O CM lê um arquivo solto e o insere na posição do drop, sem limite de tamanho, disputando com a substituição que o painel faz. Medido em 2026-09-21: nos testes a substituição do painel sempre vence (o texto final é o do arquivo), então a guarda é defesa, não correção de um bug observado |
| Leitura expandida | É o **mesmo nó** do painel "Leitura" que muda de classe (`fixed inset-0 z-50 bg-background`), com `role="dialog"`, `aria-modal` e `aria-label="Leitura"` enquanto está expandido. `Esc` fecha e o foco volta ao botão. Não usa a Fullscreen API nem o `Dialog` do design system | O Tiptap não monta o mesmo editor em dois lugares, e um segundo editor só para o overlay duplica estado. Trocar a classe mantém scroll, conteúdo e instância. A Fullscreen API foi descartada a pedido |
| Estado | Nada persiste (sem `localStorage`); expandido/recolhido é `useState` e volta a recolhido ao sair da rota | Regra do módulo |

### Dependências novas (pedem aprovação)

Tudo em `apps/web` como `dependencies`, com versões fixas (últimas estáveis em 2026-09-21):

| Pacote | Versão | Motivo |
|---|---|---|
| `@codemirror/state` | 6.7.5 | Núcleo: documento, transações, `Compartment` |
| `@codemirror/view` | 6.43.12 | Núcleo: `EditorView`, teclado, `aria` |
| `@codemirror/commands` | 6.11.1 | `defaultKeymap`, `history`, `indentWithTab` |
| `@codemirror/language` | 6.12.4 | Destaque, dobra, `bracketMatching`, `HighlightStyle` |
| `@codemirror/autocomplete` | 6.20.3 | Só o `closeBrackets` (o pacote é onde ele mora) |
| `@codemirror/search` | 6.7.2 | `⌘F` e destaque de ocorrências |
| `@codemirror/lint` | 6.9.7 | Sublinhado do erro de JSON |
| `@codemirror/lang-json` | 6.0.2 | Sintaxe JSON |
| `@codemirror/lang-yaml` | 6.1.3 | Sintaxe YAML |
| `@codemirror/lang-xml` | 6.1.0 | Sintaxe XML |
| `@codemirror/lang-markdown` | 6.5.2 | Sintaxe markdown (entrada do README) |
| `@lezer/highlight` | 1.2.3 | Os `tags` do `HighlightStyle`. Já vinha como dependência do `@codemirror/language`; foi declarado porque o tema importa dele direto (acrescentado na implementação) |

Descartados: `codemirror` (o meta-pacote `basicSetup` traz autocomplete e extras que não usamos), `@uiw/react-codemirror` e `@monaco-editor/react`.

### Testes (revisão 2)

| Nível | Cobre |
|---|---|
| Unit | `jsonLintDiagnostic(text)` (o adaptador do linter): o erro vira um intervalo de 1 caractere na posição de `findSyntaxErrorIndex`, o JSON válido não gera nada e a entrada vazia não gera nada |
| E2E `dev-tools.spec.ts` | `Tab` no editor do JSON insere indentação e o foco **continua** no editor; `Esc`+`Tab` sai; o erro aparece sublinhado (`.cm-lintRange-error`); as asserções de saída passam de `toHaveValue` para o texto do editor em JSON, Dados, Encodings e RSA; o Dados continua convertendo YAML → JSON; o README solto como arquivo entra uma vez só; o índice e Imagens **não** baixam o chunk do CodeMirror, e o parser de YAML só é baixado no Dados; README: Expandir cobre a janela (a caixa da leitura tem o tamanho da viewport), `Esc` fecha e o foco volta ao botão |

### Critérios de sucesso (revisão 2)

1. No JSON, digitar `{` + `Enter` + `Tab` + `"a": 1` produz o texto indentado, com a chave fechada automaticamente e o foco no editor.
2. JSON quebrado: sublinhado vermelho na posição e status bar com a mesma linha/coluna.
3. No Dados, colar YAML mostra cores de YAML na entrada e de JSON na saída; trocar o destino para XML troca as cores da saída.
4. `Esc` e depois `Tab` tira o foco do editor (sem armadilha de teclado).
5. O README expande para 100% da viewport, sem sidebar nem header visíveis; `Esc` e "Fechar" voltam ao layout de dois painéis com o mesmo conteúdo.
6. O índice e Imagens não baixam o CodeMirror. O núcleo do editor (sem linguagens) fica abaixo de **120 KB gzip**; se passar, paro e trago o número antes de seguir.
7. Claro e escuro legíveis (screenshots), 375 px sem scroll horizontal, e `lint`, `check-types`, `test` e `test:e2e` verdes. `openapi.json` sem diff.
8. `Tab` indenta em todos os editores de entrada (JSON, Dados, Encodings, README), e as chaves do RSA aparecem no editor só leitura com Copiar e Baixar funcionando.

## As seis ferramentas

| Rota | Ferramenta | O que faz |
|---|---|---|
| `/dev-tools` | Índice | Cards com as seis ferramentas (é a rota de layout, com `Outlet`) |
| `/dev-tools/json` | Formatador JSON | Formatar (2 espaços, 4 espaços ou tab), minificar, validar apontando linha e coluna, copiar |
| `/dev-tools/data` | Conversor de dados | JSON ⇄ YAML ⇄ CSV ⇄ XML, com detecção do formato de origem |
| `/dev-tools/encode` | Encodings | base64, base64url, URL-encode e hex — texto ↔ texto, e arquivo → base64 |
| `/dev-tools/image` | Conversor de imagens | PNG/JPEG/WebP (AVIF quando o navegador encoda), largura máxima opcional, qualidade, baixar |
| `/dev-tools/rsa` | Gerador RSA | Par 2048/3072/4096 via WebCrypto, PEM (SPKI e PKCS#8), copiar e baixar |
| `/dev-tools/readme` | Leitor de README | Markdown colado ou `.md` solto, renderizado em modo leitura |

O "conversor" do CAPABILITY-MAP vira **três** rotas (dados, encodings, imagens): as três têm entradas e controles diferentes demais para caber numa tela só.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Sem servidor | Nenhuma rota nova na API, nenhum `fetch` para terceiros. O módulo não toca `shared/api/` | Decisão do mapa. É também o que torna seguro colar um JSON de produção ou olhar uma chave privada aqui |
| Sem persistência | O conteúdo vive no estado do React e some no reload. Nada em `localStorage`, nada em cookie, nada no cache do Query | Uma chave privada ou um dump colado não deve sobreviver ao fechar a aba. Nem as preferências (indentação, formato destino) são guardadas — são dois cliques |
| Rotas ↻ | `/dev-tools/<tool>`, com `dev-tools.tsx` virando rota de layout (barra de links no topo + `Outlet`) | Link direto para cada ferramenta, chunk separado por ferramenta e a mesma estrutura que já existe no app. O índice continua renderizando o título "Dev Tools", que o `shell.spec.ts` já espera. **Barra no topo, não coluna lateral (2026-09-21):** as ferramentas são dois painéis lado a lado, e uma segunda coluna rouba justo a largura de que elas precisam — a sidebar do app já ocupa a esquerda |
| Carregamento | O índice e as ferramentas leves (JSON, encodings, imagens, RSA) renderizam no SSR como qualquer página; só o que pesa no bundle ou precisa do navegador no próprio render — README (Tiptap) e dados (parsers) — vai em `lazy` dentro de `ClientOnly` | Canvas e WebCrypto só são tocados no clique, então não atrapalham o SSR e não custam bundle (são nativos). O que não pode é Tiptap ou parser pesar no índice e nas outras rotas — ajustado em 2026-09-21, quando a primeira ferramenta mostrou que a cerimônia não se paga |
| Estado na URL | A rota diz qual ferramenta está aberta; opções e conteúdo **não** vão para a URL | Colar um arquivo inteiro numa query string não ajuda ninguém — e vazaria o conteúdo para o histórico |
| Onde mora a lógica | Tudo que é puro em `features/dev-tools/domain/<tool>.ts`, testado sem DOM; os componentes só ligam `textarea` → função → `textarea` | Convenção do foundation. É também o que deixa a bateria de testes barata: nenhum teste precisa de navegador, exceto imagem |
| Erro de JSON | `JSON.parse` decide se é válido; **quem acha a posição é um scanner próprio** (`findSyntaxErrorIndex`), e a mensagem do motor entra como reserva | Medido em 2026-09-21: o V8 só dá `at position N (line L column C)` para a família `Expected ...`; o erro mais comum (`Unexpected token 'x', ..." is not valid JSON`) **não tem posição nenhuma** — sem o scanner, um `tru` no meio de um arquivo grande não teria onde ser apontado. O scanner nunca decide validade, só localiza: se discordar do motor, o custo máximo é perder a posição. `// ponytail: recursivo, sem guarda de profundidade; um documento absurdamente aninhado cai na mensagem do motor` |
| Conversão de dados | Tudo passa por um valor JS intermediário: `parse(origem)` → valor → `serialize(destino)`. O formato de origem é detectado por heurística, com um seletor que sobrepõe a detecção | Quatro formatos com um par de funções cada, em vez de doze conversores |
| Limite do CSV | CSV só representa **array de objetos planos**: converter para CSV um objeto aninhado avisa "o CSV precisa de uma lista de objetos simples" em vez de inventar colunas | Aninhamento em CSV exige convenção (`a.b`, `a/b`) que ninguém acerta em duas pontas. A mensagem é clara e o caminho útil (lista de registros) funciona |
| Limite do XML | XML → valor é reconhecidamente com perda: atributos viram chaves `@_attr`, texto misto se perde e os valores voltam com o tipo adivinhado pelo parser (número e booleano) | É o comportamento do `fast-xml-parser` e está documentado na UI numa linha. Quem precisa de XML fiel não usa um conversor de bolso |
| YAML seguro | `js-yaml` no schema padrão (`load`, nunca `loadAll` com schema estendido, nunca tipos `!!js/*`) | O schema padrão do js-yaml não instancia funções nem objetos arbitrários; sair dele transforma "colar um YAML" em execução de código |
| UTF-8 no base64 | `TextEncoder` → bytes → base64, e o inverso — nunca `btoa(texto)` direto | `btoa` estoura em qualquer caractere fora de latin-1: "Anotação" e emoji quebram. Um helper de ~10 linhas, coberto por teste com acento e emoji |
| Imagens | `createImageBitmap(file, { imageOrientation: 'from-image' })` → `canvas` → `toBlob(tipo, qualidade)`; o suporte a WebP/AVIF é detectado em runtime e a opção some quando o navegador não encoda | API nativa do navegador, zero dependência. A reencodificação **descarta EXIF** (inclusive geolocalização) — isso é uma vantagem, e fica escrito na tela |
| Limites de tamanho | 2 MB nos campos de texto (JSON, dados, encodings, README) e 25 MB na imagem, com mensagem clara antes de processar | Uma aba travada é pior que um "arquivo grande demais". `// ponytail: limites fixos no cliente; Web Worker se um caso real bater no teto` |
| RSA | `RSASSA-PKCS1-v1_5` com SHA-256, expoente 65537, `extractable: true`; export `spki`/`pkcs8` → base64 → PEM em linhas de 64 colunas | É o par que dá o PEM `rsaEncryption` clássico, o que todo mundo espera de um "gerador RSA". A geração de 4096 leva alguns segundos: botão com estado "Gerando…" |
| Chave privada | Fica só no estado do componente: sem log, sem cópia automática, sem query string; baixar cria um `Blob` local e revoga o Object URL logo depois | É o dado mais sensível que este módulo toca |
| README | Tiptap em `editable: false` com as extensões e o `parseMarkdown` do bridge que já existe | Zero dependência nova e zero HTML injetado — o ProseMirror faz o parse, não há renderer de HTML no caminho. Limite herdado: tabela, checklist e imagem (badge) aparecem como texto, que é o conjunto de formatação aprovado no `notes` |
| Bridge markdown compartilhado | `features/notes/domain/markdown.ts` (+ `markdown.spec.ts`) **muda para** `shared/markdown.ts`, com `noteExtensions` virando `markdownExtensions`; os imports do `notes` e o CLAUDE.md acompanham | Apareceu o segundo consumidor — é a regra do próprio mapa. A alternativa (dev-tools importando de `features/notes`) amarra dois módulos que não têm nada a ver um com o outro |
| Copiar / baixar | Um `CopyButton` e um `download(blob, nome)` compartilhados pelas seis ferramentas, em `features/dev-tools/components/` | Todas as ferramentas terminam em "copiar" ou "baixar"; escrever isso seis vezes é o começo de seis comportamentos diferentes |

## Sem contrato de API

Este módulo **não** acrescenta nada em `apps/api`: nenhum controller, nenhum schema zod, nenhuma migration, nenhuma linha no `openapi.json`. Nenhuma tarefa deste módulo roda `npm run codegen`.

A única superfície de rede é a que já existe no shell (sessão do `identity`), porque as rotas ficam sob `_app`.

## Estrutura

```
apps/web/src/
  routes/_app/dev-tools.tsx           layout: Outlet (↻ a barra de links saiu na revisão 1)
  routes/_app/dev-tools/index.tsx     índice com os cards
  routes/_app/dev-tools/json.tsx      \
  routes/_app/dev-tools/data.tsx       |
  routes/_app/dev-tools/encode.tsx     |  rotas finas: o componente da ferramenta; dados e README com ClientOnly + lazy e Workspace vazio de fallback
  routes/_app/dev-tools/image.tsx      |
  routes/_app/dev-tools/rsa.tsx        |
  routes/_app/dev-tools/readme.tsx    /
  features/dev-tools/
    domain/tools.ts        lista das ferramentas (rota, nome, descrição, ícone) — índice, barra e cabeçalho de cada ferramenta
    domain/json.ts         formatar, minificar, linha/coluna do erro
    domain/data.ts         detectar formato; parse/serialize de JSON, YAML, CSV e XML
    domain/encoding.ts     base64, base64url, URL, hex — texto ↔ bytes em UTF-8
    domain/image.ts        formatos de saída suportados, nome do arquivo, cálculo do redimensionamento
    domain/rsa.ts          generateKeyPair (WebCrypto) e PEM
    components/            workspace (Workspace, Pane — ↻ substitui o tool-page), segmented,
                           code-editor (+ .css; CodeMirror, só via lazy-code-editor), lazy-code-editor,
                           json-tool, data-tool, encode-tool, image-tool, rsa-tool, readme-tool,
                           copy-button, file-drop
  shared/markdown.ts       bridge markdown ↔ Tiptap (movido de features/notes/domain)
```

A conversão de imagem em si (canvas) fica no `image-tool.tsx`: é I/O do navegador, não domínio. O que dá para testar puro (escolha de mimetype/extensão, proporção do redimensionamento) está em `domain/image.ts`.

## Dependências novas (pedem aprovação)

| Pacote | Versão | Onde | Motivo |
|---|---|---|---|
| `js-yaml` | 5.4.2 | web (dep) | YAML nos dois sentidos. Traz os próprios tipos (sem `@types`). Usado só no schema padrão |
| `papaparse` | 5.7.0 | web (dep) | CSV com aspas, vírgula no valor e quebra de linha dentro do campo — o caso que todo CSV caseiro erra |
| `@types/papaparse` | 5.5.2 | web (devDep) | O `papaparse` não publica tipos |
| `fast-xml-parser` | 5.11.1 | web (dep) | XML nos dois sentidos, sem DOM (roda igual no teste em Node e no navegador). Traz os próprios tipos |

Nada novo na API. Nada novo em `packages/ui` — o índice usa `card`, e as ferramentas usam `button`, `input`, `textarea` e `separator`, que já existem.

Descartados: `marked`/`DOMPurify` (o bridge do Tiptap já renderiza markdown sem abrir caminho de HTML); `xml2js` (Node-first, depende de `sax` e de `Buffer`); `yaml` (eemeli — bom, mas o `js-yaml` resolve e é o mais conhecido); `jose` (o gerador RSA não assina nada); qualquer lib de imagem (o canvas do navegador converte).

## Testes

| Nível | Cobre |
|---|---|
| Unit (web) — `json.ts` | Formatar com 2/4/tab; minificar; JSON inválido devolve linha e coluna certas (erro no meio, erro na primeira linha, erro no fim do arquivo); mensagem sem posição cai no texto cru; entrada vazia não é erro |
| Unit (web) — `data.ts` | Round-trip JSON → YAML → JSON e JSON → XML → JSON; CSV com vírgula, aspas e quebra de linha dentro do campo; CSV → JSON usa a primeira linha como cabeçalho; objeto aninhado → CSV devolve erro explicativo; detecção de formato para as quatro entradas (e o seletor manual sobrepondo); YAML/XML inválidos viram erro com mensagem, não exceção solta |
| Unit (web) — `encoding.ts` | Acento e emoji sobrevivem ao base64 (ida e volta); base64url não tem `+`, `/` nem `=`; hex de tamanho ímpar e base64 inválido dão erro claro; URL-encode preserva espaço e `+` |
| Unit (web) — `rsa.ts` | Gera 2048; o PEM tem os cabeçalhos certos e linhas de 64 colunas; **a chave exportada volta pelo `crypto.subtle.importKey`** (é o teste que prova que o PEM é válido de verdade); os três tamanhos são aceitos. Roda em Node 24, que tem WebCrypto global |
| Unit (web) — `image.ts` | Redimensionamento preserva a proporção e não amplia imagem menor que o limite; extensão e mimetype casam com o formato escolhido; nome do arquivo de saída troca a extensão preservando o nome |
| Unit (web) — `markdown.spec.ts` | Continua passando **igual** depois da mudança de pasta (round-trip é a rede de proteção do `notes`) |
| E2E (`dev-tools.spec.ts`) ↻ | Índice lista as seis ferramentas e cada bloco navega; cada ferramenta abre pela URL com o subitem da sidebar aberto e ativo (e o grupo já vem aberto no HTML do servidor); em 1440×900 nenhuma ferramenta rola a página e em 375 px nenhuma rola para o lado; JSON inválido mostra linha/coluna e o válido formata ao digitar; YAML colado vira JSON; texto com acento vai e volta do base64; um PNG de fixture vira WebP e o download acontece (`waitForEvent('download')`); gerar RSA 2048 mostra os dois PEM em menos de 10 s; README colado renderiza um `<h1>` e uma lista. Suíte autenticada com o `storageState` existente, **não** destrutiva (não toca sessão, senha nem notas) |

Sem teste de integração nem de contrato: não há API neste módulo. Meta de cobertura: ≥ 90% de linhas em `features/dev-tools/domain/`.

## Boundaries

- **Sempre:** processar tudo no navegador; tratar a entrada do usuário como dado (nunca `eval`, nunca `new Function`, nunca `dangerouslySetInnerHTML`); usar o `js-yaml` no schema padrão; checar os limites de tamanho **antes** de processar, com mensagem clara; revogar todo Object URL depois do download; manter as rotas sob `_app`.
- **Perguntar antes:** criar qualquer rota na API para este módulo; persistir qualquer coisa (`localStorage`, cookie, banco); adicionar dependência fora da tabela acima; ampliar o conjunto de formatação do bridge markdown (mexe no que guarda as notas); mudar o algoritmo ou o uso das chaves RSA (assinar, cifrar, exportar em OpenSSH).
- **Nunca:** mandar conteúdo das ferramentas para a API, para um analytics ou para qualquer URL externa (inclusive "buscar README de uma URL"); logar ou telemetrizar chave privada, arquivo ou texto colado; editar `shared/markdown.ts` sem rodar os testes de round-trip; importar Tiptap, canvas ou WebCrypto fora do chunk da ferramenta que usa.

## Success Criteria

1. `/dev-tools` lista as seis ferramentas e cada uma abre pela URL direta (`/dev-tools/rsa` funciona num reload); o ⌘K continua levando a "Dev Tools" e o `shell.spec.ts` passa sem mudança.
2. Um JSON quebrado mostra "linha 4, coluna 12" (ou equivalente) em vez da mensagem crua do motor; o válido formata com a indentação escolhida e minifica.
3. Colar YAML e escolher JSON converte; o caminho inverso volta ao YAML equivalente. CSV com vírgula e aspas dentro do campo sobrevive ao round-trip. Objeto aninhado → CSV explica por que não dá, sem quebrar a tela.
4. "Anotação 🎉" vai e volta do base64 e do base64url sem se corromper; um arquivo solto vira base64.
5. Um PNG vira WebP com largura máxima aplicada, o arquivo baixado abre, e o tamanho antes/depois aparece na tela.
6. Gerar RSA 2048 produz dois PEM; colar o PEM público em `openssl rsa -pubin -text -noout` (ou reimportar pelo WebCrypto, que é o teste automatizado) funciona; 4096 termina com o botão em "Gerando…" e não congela a interface.
7. Um README colado renderiza títulos, listas, citação, código e links; tabela e badge aparecem como texto, sem quebrar a página.
8. Nenhuma requisição sai da aba ao usar qualquer ferramenta (checado na aba Network do e2e/devtools) e nada aparece em `localStorage` depois de usar as seis.
9. `/dev-tools` e as seis rotas funcionam em desktop e em 375 px de largura sem scroll horizontal; o índice não carrega Tiptap, canvas nem os parsers.
10. `lint`, `check-types`, `test` e `test:e2e` passam; `openapi.json` **não muda**; README, CLAUDE.md e CAPABILITY-MAP atualizados (inclusive o novo caminho do bridge markdown).

## Riscos

| Risco | Mitigação |
|---|---|
| Mover `markdown.ts` quebra o editor de notas, que acabou de ser entregue | A mudança é só de pasta e de nome de um export; `markdown.spec.ts` vai junto e é a prova. É a primeira tarefa do plano, num commit isolado, antes de existir qualquer ferramenta |
| A posição do erro de JSON depende do texto da mensagem do V8 | Extração com regex tolerante e fallback para a mensagem crua; teste cobre os dois caminhos. Marcado com `// ponytail:` |
| `js-yaml` com schema errado vira execução de código a partir de um YAML colado | Só `load` no schema padrão; está escrito no boundary e é o tipo de coisa que revisão pega. Sem `!!js/*`, sem schema customizado |
| Arquivo grande trava a aba (canvas, base64, parse) | Limites checados antes (2 MB texto, 25 MB imagem) com mensagem; conversão de imagem via `createImageBitmap`, que é assíncrono |
| `toBlob` não encoda AVIF/WebP no navegador do momento | Suporte detectado em runtime; a opção some quando não existe, em vez de baixar um PNG disfarçado |
| README com tabela ou badge fica pobre | Limite conhecido e aceito (é o conjunto de formatação do `notes`); a alternativa (`marked` + sanitizer) está descartada nas decisões e é reversível |
| `JSON.parse` perde precisão em inteiro acima de 2^53 | Documentado na tela do formatador numa linha. `// ponytail: sem BigInt no JSON; trocar por um parser com reviver se aparecer um caso real` |
| Seis ferramentas viram seis telas diferentes ↻ | Um `ToolPage` (título, descrição, aviso de "roda no seu navegador") e os mesmos `CopyButton`/`FileDrop` para todas |

## Open Questions

Nenhuma bloqueante. Quatro julgamentos que ficam registrados e são reversíveis sem custo:

1. **CSV só lida com lista de objetos planos** — aninhamento devolve erro explicativo em vez de achatar com `a.b`.
2. **XML → dados é com perda** (atributos como `@_attr`, tudo string). Quem precisa de fidelidade não usa esta ferramenta.
3. **A reencodificação de imagem descarta EXIF**, inclusive geolocalização — tratado como vantagem e avisado na tela.
4. **Decodificar JWT ficou de fora**, mesmo sendo quase de graça sobre o base64url: não está no mapa. Se quiser, entra como modo da ferramenta de encodings.
