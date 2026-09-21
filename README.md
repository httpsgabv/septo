# septo

Um lugar só para as ferramentas que hoje ficam espalhadas em vários apps: notas e lembretes, e ferramentas do dia a dia de dev (formatador JSON, gerador de chaves RSA, conversores de dados, encodings e imagens, leitor de README) — essas últimas rodando inteiras no navegador.

Projeto pessoal, usuário único, hospedado numa VPS.

## Stack

| | |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| API | NestJS 12 (ESM, SWC) · Prisma 7 + PostgreSQL 18 · zod → OpenAPI · docs no Scalar |
| Web | TanStack Start (SSR) · TanStack Query · client gerado pelo Orval (axios) |
| UI | `@septo/ui`: Tailwind v4 + shadcn (Base UI), tema claro/escuro e cor de destaque customizável |
| Qualidade | Biome · Vitest · Playwright |
| Infra | Docker Compose · Caddy (HTTPS automático) |

## Começando

Requisitos: Node ≥ 24.7 (o hash de senha usa `crypto.argon2`; há um `.nvmrc`, então `nvm install && nvm use`), npm 11, Docker.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate -w @septo/api
npm run user:set -w @septo/api -- <usuário>
npm run dev
```

O septo tem um único usuário e não há cadastro pela interface: `user:set` pede a senha (12 a 128 caracteres) duas vezes, sem eco, e cria o usuário. Rodar de novo troca username e senha e derruba todas as sessões, então também serve para resetar uma senha esquecida.

- App: http://localhost:5173 ou https://localhost (via Caddy); sem sessão, qualquer página leva a `/login`
- Docs da API (Scalar): http://localhost:5173/api/docs

`docker compose up -d` sobe só a infra: o Postgres (porta **5433**, apenas em `127.0.0.1`, para não brigar com um Postgres local) e o Caddy, que dá HTTPS em https://localhost na frente dos servidores de dev (útil para Web Push e cookies `Secure`). O navegador avisa sobre o certificado local do Caddy até você confiar nele.

## O que já existe

- **Login** (`identity`): usuário único, sessão em cookie, troca de senha e nome de exibição em `/settings`.
- **Notas** (`notes`), em `/notes`:
  - editor WYSIWYG (Tiptap) que guarda **markdown**: `## `, `- `, `1. `, `> `, `**negrito**`, `*itálico*`, `~~riscado~~`, `` `código` ``, blocos de código, links e linha horizontal;
  - **autosave**, sem botão Salvar (indicador "Salvando… / Salvo"); "Nova nota" abre um rascunho que só vira nota no primeiro salvamento com conteúdo;
  - tags, fixar, arquivar (e desarquivar) e excluir com confirmação;
  - busca por título e corpo, sem diferenciar acento nem caixa; busca, tag e aba (`Ativas`, `Lembretes`, `Arquivadas`) ficam na URL;
  - lembrete (`remindAt`) em qualquer nota, com a aba "Lembretes" ordenada por data. O **aviso** (Web Push) é o módulo `reminders`, ainda pendente.

- **Dev Tools** (`dev-tools`), em `/dev-tools` — seis ferramentas que rodam inteiras no navegador: nada é enviado para o servidor e nada fica guardado ao sair da página.
  - **JSON**: formatar (2 espaços, 4 ou tab), minificar e apontar **linha e coluna** do erro, inclusive nos casos em que o próprio navegador não diz onde foi;
  - **Dados**: converter entre JSON, YAML, CSV e XML, com o formato de entrada detectado (e um seletor que decide no lugar dele);
  - **Encodings**: base64, base64url, URL e hex nos dois sentidos, com UTF-8 de verdade (acento e emoji sobrevivem), e arquivo → base64;
  - **Imagens**: converter para PNG, JPEG ou WebP (e AVIF onde o navegador encoda), com largura máxima e qualidade — a reescrita descarta o EXIF, geolocalização incluída;
  - **Chaves RSA**: gerar um par 2048/3072/4096 pelo WebCrypto e copiar ou baixar os dois PEM;
  - **README**: ler markdown renderizado, com o mesmo conjunto de formatação do editor de notas.

Depois de atualizar o repositório, rode `npm run db:migrate -w @septo/api` para aplicar as migrações novas (a de notas cria a tabela `notes`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | API (:3333) + web (:5173), gerando antes o contrato e o client |
| `npm run build` | Build de tudo, com cache do Turbo |
| `npm run check-types` | Type-check de todos os pacotes |
| `npm run test` | Testes unitários e de integração (a API usa o banco `septo_test`, precisa do Postgres no ar) |
| `npm run coverage -w @septo/api` | Cobertura de linhas e ramos das camadas `domain` e `application` (meta ≥ 90%) |
| `npm run coverage -w @septo/web` | Cobertura das funções puras do web (`features/*/domain`, `shared`) |
| `npm run test:e2e` | Playwright; sobe a própria API (:3433) e o próprio web (:5273) no banco `septo_test`, com um usuário de teste, sem tocar nos servidores nem no banco de desenvolvimento (precisa do Postgres no ar e de `npx playwright install chromium` na primeira vez) |
| `npm run user:set -w @septo/api -- <usuário>` | Cria o usuário único ou reseta a senha (derruba todas as sessões) |
| `docker compose up -d` | Infra: Postgres + Caddy (https://localhost) |
| `npm run lint` / `npm run format` | Biome: verificar / corrigir |
| `npm run codegen` | Gera `apps/api/openapi.json` e o client do web |
| `npm run db:migrate -w @septo/api` | Cria e aplica migrações do Prisma |

### Mudou a API?

O contrato nasce nos schemas zod dos controllers. Depois de mudar um endpoint:

```bash
npm run codegen
```

Isso atualiza o `apps/api/openapi.json` (que é commitado) e regenera os hooks do web. Um teste falha se o arquivo commitado estiver desatualizado.

## Produção

O compose continua só com Postgres e Caddy. API e web rodam como imagens avulsas na rede `septo` (criada pelo compose), sem publicar portas:

```bash
docker build -f apps/api/Dockerfile -t septo-api .
```

```bash
docker build -f apps/web/Dockerfile -t septo-web .
```

```bash
docker run -d --name septo-api --network septo --restart unless-stopped -e DATABASE_URL=postgresql://septo:<senha>@postgres:5432/septo -e JWT_SECRET=<segredo> -e API_DOCS_ENABLED=false septo-api
```

`JWT_SECRET` assina as sessões e é obrigatório em produção (a API não sobe sem ele), com pelo menos 32 caracteres. Gere um com `openssl rand -base64 48`. Trocá-lo derruba todas as sessões. `API_DOCS_ENABLED=false` tira o Scalar e o `openapi.json` do ar; deixe `true` só se quiser os docs públicos.

Crie o usuário (uma vez) e, quando precisar, resete a senha com o mesmo comando:

```bash
docker exec -it septo-api node dist/cli/set-user.js <usuário>
```

```bash
docker run -d --name septo-web --network septo --restart unless-stopped -e API_INTERNAL_URL=http://septo-api:3333 septo-web
```

No `.env` da VPS:

```dotenv
APP_DOMAIN=seu.dominio
API_UPSTREAM=septo-api:3333
WEB_UPSTREAM=septo-web:5173
POSTGRES_PASSWORD=<senha forte>
```

Depois `docker compose up -d`. O Caddy emite o certificado Let's Encrypt sozinho: aponte o DNS para a VPS e abra as portas 80 e 443. A API aplica as migrações do Prisma ao iniciar.

## Estrutura

```
apps/api            NestJS: um módulo por contexto (domain / application / infrastructure / presentation)
apps/web            TanStack Start: src/routes (finas) + src/features/<contexto>
packages/ui         design system
packages/typescript-config
specs/              uma spec por módulo
tasks/<módulo>/     plano e tarefas do módulo
```

## Documentação

- [CAPABILITY-MAP.md](CAPABILITY-MAP.md): módulos, ordem de construção e decisões globais
- [specs/](specs/): a spec de cada módulo. A do [foundation](specs/SPEC-foundation.md) define as convenções que valem para todo o projeto
- [CLAUDE.md](CLAUDE.md): contexto para agentes de IA
