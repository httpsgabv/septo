# Spec: foundation

> Módulo `foundation` do [CAPABILITY-MAP](../CAPABILITY-MAP.md). Status: **aprovada** em 2026-09-18. Plano: [tasks/foundation/plan.md](../tasks/foundation/plan.md).
> Além da base técnica, esta spec define as **convenções globais** (arquitetura, estilo, testes, limites) que todas as outras specs herdam.

## Objetivo

Transformar o scaffold do create-turbo na base do septo: um monorepo com API NestJS documentada em OpenAPI (Scalar), frontend TanStack Start com client gerado pelo Orval, design system próprio e infra Docker, pronto para receber os módulos `identity`, `notes`, `reminders` e `dev-tools` sem retrabalho.

Usuário: eu (único usuário). Sucesso = consigo clonar, subir o banco, rodar `npm run dev` e ver o shell do app navegável, com API respondendo, documentação navegável no Scalar e o design system aplicado; e consigo subir tudo em produção com um `docker compose up`.

Fora de escopo: login (módulo `identity`), qualquer feature de negócio, CI/CD (pedir antes).

## Tech Stack

| Camada | Tecnologia | Versão alvo |
|---|---|---|
| Runtime | Node.js | ≥ 24 (local: 26) |
| Monorepo | Turborepo + npm workspaces | turbo 2.10, npm 11 |
| Linguagem | TypeScript — web e pacotes | 7.0 |
| Linguagem (API) | TypeScript — a API fica no 6 porque o Nest CLI exige a API programática do compilador, que o TS 7.0 não tem (volta na 7.1) | 6.0 |
| Lint + format | Biome (substitui ESLint e Prettier) | 2.5 |
| Schemas | zod — DTOs da API, formulários, env | 4 |
| API | NestJS (`@nestjs/platform-express`), em ESM (`"type": "module"`, imports relativos com `.js`) | 12 |
| Build da API | Nest CLI com builder SWC | @swc/core 1.16 |
| OpenAPI | `@nestjs/swagger` (só geração do documento, sem CLI plugin) | 12 |
| Docs da API | Scalar (`@scalar/nestjs-api-reference`) em `/api/docs` | 1.2 |
| Client HTTP | Orval (gera hooks TanStack Query + schemas zod) sobre axios | orval 8, axios 1.20 |
| ORM | Prisma + `@prisma/adapter-pg` | 7.10 (fixo — `latest` do npm é 8.0 RC) |
| Banco | PostgreSQL | 18 (`postgres:18-alpine`) |
| Frontend | TanStack Start + TanStack Router (Vite) | start 1.168, vite 8 |
| Cache/estado servidor | TanStack Query | 5 |
| Estilo | Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react | tailwind 4.3 |
| Testes | Vitest (+ `unplugin-swc` na API), Playwright | vitest 5, playwright 1.63 |
| Proxy/HTTPS | Caddy | 2 |

Descartados: tRPC (decisão do projeto); `nestjs-zod` (peer deps só até Nest 11); `class-validator`/`class-transformer` (usamos zod).

## Commands

```bash
npm install                              # instala todo o monorepo
cp .env.example .env                     # uma vez
docker compose up -d postgres            # dev: só o banco em container
npm run dev                              # turbo: codegen + api :3333 + web :5173
npm run codegen                          # turbo: api gera openapi.json → web roda orval
npm run build                            # turbo build (com cache; depende de codegen)
npm run lint                             # biome check . (lint + format + imports)
npm run format                           # biome check --write .
npm run check-types                      # turbo: tsc --noEmit em todos os pacotes
npm run test                             # turbo: vitest em todos os pacotes
npm run test:e2e                         # playwright contra web+api em dev
npm run db:migrate -w @septo/api         # prisma migrate dev
npm run db:generate -w @septo/api        # prisma generate
docker compose up -d --build             # stack completa: postgres, api, web, caddy
```

Biome roda na raiz (é rápido e enxerga o repo inteiro); não passa pelo Turbo.

## Arquitetura

### Tráfego

```
navegador ──HTTPS──▶ Caddy (${APP_DOMAIN}) ─┬─ /api/*  ──▶ api :3333 ──▶ postgres :5432
                                            └─ /*      ──▶ web :5173 (SSR TanStack Start)
SSR do web ──HTTP interno (${API_INTERNAL_URL})──▶ api
```

Mesma origem para web e API → cookie de sessão sem CORS. Em dev, o Vite faz proxy de `/api` para `:3333`, reproduzindo o mesmo comportamento.

### Contrato da API: zod → OpenAPI → Orval

A **fonte da verdade** do contrato são os schemas zod da camada `presentation` da API. O resto é derivado:

```
zod (DTOs em presentation) ──z.toJSONSchema──▶ @nestjs/swagger ──▶ apps/api/openapi.json ──orval──▶ apps/web/src/shared/api/generated/
                                                        │                                             ├─ hooks TanStack Query (axios)
                                                        └─▶ Scalar em /api/docs                        └─ schemas zod (formulários)
```

| Peça | Decisão |
|---|---|
| Validação de entrada | `ZodValidationPipe` próprio (~15 linhas) em `src/shared/http/` |
| Documentação dos DTOs | decorators de **parâmetro** `@ZodBody(schema)`, `@ZodQuery(schema)`, `@ZodParams(schema)` (validam aquele argumento e documentam o handler) e o decorator de método `@ZodResponse(status, schema?)`, todos sobre `z.toJSONSchema(schema, { target: 'openapi-3.0' })`. Schemas com `.meta({ id })` viram `components/schemas` nomeados. Substitui o `nestjs-zod` |
| operationId | nome do método do controller — vira o nome do hook no Orval (`listNotes` → `useListNotes`). Por isso nomes de métodos são únicos na API inteira (verbo + substantivo); duplicata derruba a geração do documento |
| Datas no contrato | `z.iso.datetime()` (string ISO); `z.date()` não é representável em JSON Schema. Conversão `Date` ↔ string nos mappers de `presentation` |
| `openapi.json` | gerado por script (`npm run openapi -w @septo/api`) que monta o `AppModule` sem abrir porta; **commitado** — mudanças no contrato aparecem no diff do PR |
| Client do web | Orval com `client: 'react-query'`, `httpClient: 'axios'` e um `mutator` (`src/shared/api/http-client.ts`) com a instância axios: `baseURL` `/api` no navegador, `API_INTERNAL_URL` no SSR repassando o cookie da requisição, `withCredentials: true` |
| Schemas no web | segundo output do Orval com `client: 'zod'` — formulários validam com o mesmo contrato da API |
| Código gerado | **não commitado** (`.gitignore`); produzido pela task `codegen` do Turbo, com cache, antes de `dev`, `check-types`, `build` e `test` do web |
| Scalar | `GET /api/docs` (UI) e `GET /api/openapi.json`; habilitado por `API_DOCS_ENABLED` (default `true` em dev) |
| Erros | exception filter global converte `DomainError` e erros de validação em JSON padrão `{ code, message, details? }`, documentado no OpenAPI |

Consequência: **`@septo/contracts` não existe** — tipos e schemas do web vêm do Orval (aprovado em 2026-09-18).

### API — Clean Architecture por bounded context

Cada contexto é um módulo Nest com quatro camadas; a dependência aponta só para dentro:

```
presentation ──▶ application ──▶ domain
infrastructure ─▶ application/domain (implementa as portas)
```

| Camada | Contém | Pode importar |
|---|---|---|
| `domain` | entidades, value objects, erros de domínio, portas (repositórios) | nada de framework — TS puro |
| `application` | casos de uso (um por arquivo, método `execute`) | `domain` |
| `infrastructure` | repositórios Prisma, mappers Prisma ↔ domínio, clients externos | `domain`, `application`, Prisma |
| `presentation` | controllers REST, schemas zod de request/response, mappers domínio → response | `application`, `domain` (tipos), zod, Nest |

Regras:
- Prisma **só** em `infrastructure`. Entidade de domínio nunca é o model do Prisma nem o DTO de resposta.
- Portas existem só em fronteiras reais (persistência, serviços externos, relógio). Casos de uso **não** têm interface.
- Portas são `abstract class` — servem como token de DI no Nest sem `@Inject('STRING')`.
- Erros de domínio estendem `DomainError`; o exception filter global mapeia para status HTTP.
- Rotas sob o prefixo global `/api`, em inglês, no plural: `/api/notes`, `/api/notes/:id/archive`.

### Web — organização por feature

```
apps/web/src/
  routes/                 rotas do TanStack Router (finas: compõem features)
  features/<contexto>/
    domain/               funções e tipos puros (sem React)
    components/           componentes do contexto (consomem hooks gerados)
  shared/
    api/http-client.ts    instância axios (mutator do Orval)
    api/generated/        saída do Orval (gitignored)
    ...                   shell, layout, providers, utilitários de app
```

- Rotas não contêm regra de negócio; delegam para `features/`.
- Lógica pura (ex.: formatar JSON) vive em `domain/` e é testada sem DOM.
- Chamadas à API **só** pelos hooks/funções gerados — nada de `axios.get` avulso.
- Componentes genéricos vêm de `@septo/ui`; componente só vai para `packages/ui` se for agnóstico ao septo.

### Design system (`@septo/ui`)

**Premium minimalista, dark-first, estilo Linear/Raycast.**
- Tokens em CSS variables (Tailwind v4 `@theme`): paleta neutra (zinc), raios, sombras sutis, bordas finas, tipografia Geist Sans / Geist Mono.
- **Acento customizável**: uma única variável `--accent-base` (default `#5808a3`). Hover, foco, fundos suaves e variante de texto são derivados dela com cores relativas `oklch(from var(--accent-base) …)` — trocar a cor não exige recalcular paleta.
  - `#5808a3` é escuro: como fundo (botão primário) usa texto branco; como texto/borda sobre fundo escuro usa a variante clareada derivada, garantindo contraste AA.
  - Configurações do app têm seletor com presets + cor livre; a escolha fica em `localStorage` e é aplicada por script inline no `<head>` (sem flash). Sem persistência no servidor na v1.
- Tema claro e escuro, seguindo `prefers-color-scheme` com toggle manual persistido.
- Componentes shadcn copiados para `packages/ui/src/components`, exportados por subpath (`@septo/ui/button`).
- Acessibilidade: foco visível, contraste AA, navegação por teclado (garantida pelo Radix).

### Shell do app

- Sidebar com os contextos (Notas, Dev Tools), colapsável; em mobile vira drawer.
- Header com atalho **⌘K** (command palette navegando entre ferramentas).
- Página de Configurações com tema e cor de acento.
- Páginas placeholder para Notas e Dev Tools (conteúdo real vem nos respectivos módulos).

## Variáveis de ambiente

Todas em `.env.example`, validadas com zod no boot de cada app (falha rápida se faltar algo).

| Variável | Default dev | Uso |
|---|---|---|
| `APP_DOMAIN` | `localhost` | Caddyfile (em produção: seu domínio) |
| `APP_URL` | `https://localhost` | URL pública |
| `API_PORT` | `3333` | porta da API |
| `WEB_PORT` | `5173` | porta do web |
| `API_INTERNAL_URL` | `http://localhost:3333` | SSR → API (`http://api:3333` no compose) |
| `API_DOCS_ENABLED` | `true` | expõe Scalar e `openapi.json` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `septo` / `septo` / `septo` | container do Postgres |
| `DATABASE_URL` | `postgresql://septo:septo@localhost:5432/septo` | Prisma |

## Project Structure

```
septo/
  CAPABILITY-MAP.md        índice de módulos e decisões globais
  CLAUDE.md                contexto para agentes: aponta para map, specs e convenções
  README.md                visão geral + comandos
  biome.json               lint + format do repo inteiro
  specs/SPEC-<id>.md       uma spec por módulo
  tasks/plan.md, todo.md   plano e tarefas do módulo em andamento
  compose.yaml             postgres, api, web, caddy
  Caddyfile
  .env.example
  apps/
    api/                   @septo/api
      openapi.json         contrato gerado (commitado)
      prisma/schema.prisma, prisma.config.ts
      src/main.ts, app.module.ts
      src/openapi.ts       monta o documento (usado pelo main e pelo script de geração)
      src/shared/          DomainError, exception filter, env (zod), PrismaService
      src/shared/http/     ZodValidationPipe, @ZodBody/@ZodQuery/@ZodParams/@ZodResponse
      src/modules/<contexto>/{domain,application,infrastructure,presentation}
      test/                testes de integração
      Dockerfile
    web/                   @septo/web
      orval.config.ts
      src/routes, src/features, src/shared
      e2e/                 specs Playwright
      Dockerfile
  packages/
    ui/                    @septo/ui
    typescript-config/     @septo/typescript-config
```

Removidos: `apps/docs`, Next.js de `apps/web`, componentes demo de `packages/ui`, `packages/eslint-config` (substituído por Biome), Prettier.

## Code Style

```ts
// apps/api/src/modules/notes/domain/note.ts
export class Note {
  private constructor(
    readonly id: NoteId,
    private props: { title: string; body: string; archivedAt: Date | null },
  ) {}

  static create(id: NoteId, title: string, body: string): Note {
    if (!title.trim() && !body.trim()) throw new EmptyNoteError();
    return new Note(id, { title: title.trim(), body, archivedAt: null });
  }

  archive(now: Date): void {
    this.props.archivedAt ??= now;
  }
}

// apps/api/src/modules/notes/domain/note.repository.ts
export abstract class NoteRepository {
  abstract findById(id: NoteId): Promise<Note | null>;
  abstract save(note: Note): Promise<void>;
}

// apps/api/src/modules/notes/application/archive-note.use-case.ts
@Injectable()
export class ArchiveNoteUseCase {
  constructor(private readonly notes: NoteRepository, private readonly clock: Clock) {}

  async execute(id: NoteId): Promise<void> {
    const note = await this.notes.findById(id);
    if (!note) throw new NoteNotFoundError(id);
    note.archive(this.clock.now());
    await this.notes.save(note);
  }
}

// apps/api/src/modules/notes/presentation/notes.controller.ts
export const noteIdParams = z.object({ id: z.uuid() });

@Controller('notes')
export class NotesController {
  constructor(private readonly archiveNoteUseCase: ArchiveNoteUseCase) {}

  @Post(':id/archive')
  @HttpCode(204)
  @ZodResponse(204)
  archiveNote(@ZodParams(noteIdParams) { id }: z.infer<typeof noteIdParams>): Promise<void> {
    return this.archiveNoteUseCase.execute(id);
  }
}
```

```tsx
// apps/web/src/features/notes/components/archive-note-button.tsx
export function ArchiveNoteButton({ id }: { id: string }) {
  const archive = useArchiveNote(); // gerado pelo Orval
  return (
    <Button variant="ghost" onClick={() => archive.mutate({ id })} disabled={archive.isPending}>
      Arquivar
    </Button>
  );
}
```

Convenções:
- Arquivos `kebab-case` com sufixo de papel: `.use-case.ts`, `.repository.ts`, `.prisma-repository.ts`, `.controller.ts`, `.schemas.ts`, `.spec.ts`.
- Classes `PascalCase`, funções/variáveis `camelCase`, constantes de módulo `SCREAMING_SNAKE_CASE`.
- Sem `any`; `strict: true` em todos os pacotes.
- Biome com config única na raiz, zero warnings; código gerado (`generated/`) excluído do lint.
- Simplicidade primeiro (ponytail): nada especulativo; atalhos deliberados marcados com `// ponytail: <limite>, <como evoluir>`.
- Comentários explicam *por quê*, não *o quê*.

## Testing Strategy

| Nível | Ferramenta | Onde | Cobre |
|---|---|---|---|
| Unit | Vitest | `*.spec.ts` ao lado do arquivo | domínio, casos de uso (com fakes das portas), funções puras do web, `ZodValidationPipe` |
| Integração | Vitest + supertest + Postgres real (banco `septo_test` no compose) | `apps/api/test/` | HTTP → controller → caso de uso → Prisma |
| Contrato | Vitest | `apps/api/test/` | `openapi.json` commitado é igual ao gerado (falha se alguém esqueceu de regenerar) |
| E2E | Playwright | `apps/web/e2e/` | fluxos críticos no navegador |

- TDD para regra de domínio e casos de uso.
- Meta de cobertura: ≥ 90% de linhas em `domain/` e `application/`; sem meta global.
- Foundation entrega: integração do `/api/health`, teste de contrato do OpenAPI e um e2e de fumaça do shell (inclui status da API renderizado via SSR com hook gerado).

## Boundaries

- **Sempre:** rodar `lint`, `check-types` e `test` antes de commitar; regenerar e commitar `openapi.json` ao mudar a API; seguir as camadas e a direção de dependência; validar toda entrada com zod; atualizar spec/CAPABILITY-MAP/README quando uma decisão mudar; perguntar quando houver dúvida.
- **Perguntar antes:** adicionar dependência fora da tabela de Tech Stack; mudar schema do banco além do que a spec do módulo define; criar novo pacote em `packages/`; configurar CI/CD; mudar portas, domínios ou decisões do CAPABILITY-MAP.
- **Nunca:** commitar segredos ou `.env`; editar código gerado pelo Orval à mão; importar Prisma fora de `infrastructure`; importar framework em `domain`; chamar a API no web sem passar pelo client gerado; desabilitar lint/teste para passar; remover teste falhando sem aprovação.

## Success Criteria

1. `apps/docs`, Next.js, ESLint e Prettier removidos; `apps/web` roda TanStack Start em `:5173`; todos os pacotes sob o escopo `@septo/*`.
2. `GET /api/health` retorna `200 {"status":"ok","db":"up"}` e `503` com `"db":"down"` se o Postgres cair; o endpoint aparece documentado no Scalar em `/api/docs`.
3. Mudar o schema zod de resposta do health e rodar `npm run codegen` quebra o `check-types` do web onde o campo é usado — prova de que o contrato flui zod → OpenAPI → Orval.
4. Entrada inválida em qualquer endpoint retorna `400 { code: "VALIDATION_ERROR", message, details }`.
5. Shell renderiza sidebar, header, ⌘K, toggle de tema e Configurações; em desktop e em 375 px de largura sem scroll horizontal; status da API aparece renderizado no SSR.
6. Trocar a cor de acento nas Configurações recolore o app inteiro instantaneamente, persiste após reload, sem flash; default `#5808a3`; texto com acento mantém contraste AA nos dois temas.
7. A partir de um clone limpo: `npm install && cp .env.example .env && docker compose up -d postgres && npm run dev` funciona sem outros passos.
8. `npm run lint`, `check-types`, `build` e `test` passam; segunda execução de `npm run build` é 100% cache hit.
9. `docker compose up -d --build` sobe a stack; `https://localhost` serve o web e `https://localhost/api/health` responde via Caddy; trocar `APP_DOMAIN` é o único passo para usar o domínio real.
10. README, CLAUDE.md e CAPABILITY-MAP atualizados.

## Riscos

| Risco | Mitigação |
|---|---|
| TS 7.0 não tem API programática → `nest build` e o CLI plugin do `@nestjs/swagger` não rodam nele | **Confirmado na T2:** a API fixa `typescript@6.0` (type-check e Nest CLI) e compila com SWC; sem CLI plugin — DTOs documentados via zod. Voltar a API para TS 7 quando a 7.1 sair |
| `z.toJSONSchema` gera construções que o `@nestjs/swagger`/Orval interpretam mal (ex.: `anyOf` com `null`, formatos) | Primeira tarefa do plano é um spike ponta a ponta (schema zod → OpenAPI → hook Orval) com tipos opcionais, nullable, enum e uuid |
| Codegen desatualizado entre API e web | `openapi.json` commitado + teste de contrato; `codegen` como dependência das tasks do web no Turbo |
| SSR precisa repassar cookie para a API | Mutator do axios lê headers da requisição no servidor (`@tanstack/react-start/server`); coberto no e2e |
| `prisma@latest` no npm é 8.0 RC | Versão fixa em 7.10.x |
| Web Push exige HTTPS | Caddy já na foundation (usado pelo `reminders`) |

## Open Questions

Nenhuma.
