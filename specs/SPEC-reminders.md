# Spec: reminders

> Módulo `reminders` do [CAPABILITY-MAP](../CAPABILITY-MAP.md). Status: **aprovada** em 2026-09-21. Plano: [tasks/reminders/plan.md](../tasks/reminders/plan.md).
> Herda as convenções globais de [SPEC-foundation](SPEC-foundation.md): camadas, contrato zod → OpenAPI → Orval, estilo, testes e limites. Depende de [SPEC-notes](SPEC-notes.md): `notes` é dono de `remindAt`; este módulo é dono da entrega.

## Premissas aprovadas

1. Um lembrete é enviado para **todos** os navegadores/dispositivos com assinatura ativa; não há seleção de dispositivo por nota.
2. Se a API ficar fora do ar, lembretes vencidos há no máximo 24 horas são enviados quando ela voltar; os mais antigos são ignorados.
3. A notificação mostra `Lembrete` como título e o título da nota como corpo; o corpo markdown não aparece na tela bloqueada.
4. A v1 roda com uma única instância da API, como já previsto no deploy. Coordenação distribuída entre réplicas fica fora de escopo.
5. PWA nesta spec significa instalação, service worker e Web Push; uso offline e cache de conteúdo não fazem parte da v1.

## Objetivo

Entregar no horário os lembretes definidos nas notas, mesmo quando o septo não está aberto, por Web Push padrão com VAPID. Cada navegador compatível pode ser habilitado ou desabilitado separadamente em Configurações. O mesmo service worker torna o web instalável como PWA e abre a nota correta quando a notificação é acionada.

Sucesso = habilito notificações por uma ação explícita, marco uma nota para alguns minutos no futuro, fecho o app e recebo uma notificação em até dois minutos do horário; ao tocar nela, o septo abre ou ganha foco diretamente naquela nota. O mesmo lembrete não é reenviado em ticks normais do scheduler.

### Histórias

1. Em Configurações → Notificações vejo se este navegador é compatível e se a permissão está disponível, concedida ou bloqueada.
2. Clico em "Ativar notificações"; só então o navegador pede permissão, cria uma assinatura ligada à chave VAPID do septo e a API a persiste.
3. Ativo outro navegador ou dispositivo e os dois recebem os lembretes seguintes, de forma independente.
4. Reabro o app com uma assinatura já existente e ele reconcilia essa assinatura com a API sem exibir outro prompt.
5. Desativo as notificações neste navegador; a assinatura é removida da API e do `PushManager`, sem afetar os outros dispositivos.
6. Defino um `remindAt` futuro numa nota não arquivada e recebo uma única notificação por assinatura ativa.
7. Clico na notificação e uma janela já aberta ganha foco e navega para `/notes/<id>`; sem janela aberta, uma é criada nessa URL.
8. Instalo o septo como PWA e ele abre em modo `standalone`, com nome, cores e ícones próprios.
9. Se um push service responder que uma assinatura expirou, ela é removida automaticamente e deixa de ser tentada.

### Fora de escopo (v1)

Recorrência, snooze/adiar, ações dentro da notificação, som customizado, horário silencioso, preferências por nota ou dispositivo, e-mail/SMS, lembrete sem nota, gerenciamento/listagem de dispositivos, histórico de entregas na UI, botão de push de teste, badge, sincronização periódica, background sync, cache offline, edição offline, precache do app, atualização automática de `remindAt` depois do envio, garantia de entrega exatamente uma vez e scheduler distribuído para múltiplas instâncias da API.

## Tech Stack

Herda toda a stack do foundation e acrescenta:

| Camada | Tecnologia | Versão alvo | Uso |
|---|---|---|---|
| API | `web-push` | 3.6.7 | VAPID, criptografia do payload e envio ao push service de cada navegador |
| API (tipos) | `@types/web-push` | 3.6.4 | Tipos TypeScript do adapter; dependência de desenvolvimento |
| Web | Push API + Notifications API + Service Worker API | APIs nativas | Assinar o navegador, receber o push e exibir/acionar a notificação |
| PWA | Web App Manifest estático | padrão web | Instalação e identidade do app, sem Workbox nem plugin de PWA |

Não adicionar `@nestjs/schedule`: um provider Nest com `setInterval` de 60 segundos, ciclo de vida explícito e trava local cobre a única instância prevista. Não adicionar `vite-plugin-pwa`/Workbox: o service worker não intercepta `fetch` e cabe num arquivo pequeno, auditável e sem estratégia de cache.

## Commands

```bash
npm install                                           # instala o monorepo e as novas dependências
npm exec --workspace @septo/api -- web-push generate-vapid-keys --json
npm run db:migrate -w @septo/api                      # cria assinaturas e entregas
npm run codegen                                       # regenera OpenAPI → Orval depois do contrato HTTP
npm run test -w @septo/api -- src/modules/reminders   # unitários do módulo
npm run test -w @septo/web -- src/features/reminders  # unitários do web
npm run test                                          # todos os unitários/integrações do monorepo
npm run test:e2e                                      # fluxos Playwright
npm run lint
npm run check-types
npm run build
```

As chaves VAPID são geradas uma vez por ambiente. O comando apenas as imprime; o operador as copia para o gerenciador de segredos/variáveis de ambiente. Ele nunca escreve a chave privada no repositório.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Dono do agendamento | `notes` continua dono de `remindAt`; `reminders` não altera a nota depois do envio | Lembrete é atributo da nota. Entrega é uma capacidade separada e pode falhar/repetir sem corromper a nota |
| Fronteira `notes` → `reminders` | `NotesModule` exporta um `ReminderSource` somente leitura, definido no domínio de `notes`; `reminders` não importa Prisma nem `NoteRepository` | O contrato vive no módulo provedor e expõe só o necessário para entrega |
| Polling | Um tick imediato no boot e depois a cada 60 s; se o tick anterior ainda estiver rodando, o próximo é ignorado | Cumpre o mapa sem sobreposição local nem dependência de scheduler |
| Janela de recuperação | Candidatos com `remindAt` em `(now - 24 h, now]` podem ser materializados; mais antigos são ignorados | Recupera uma indisponibilidade comum sem disparar lembretes esquecidos há dias |
| Lembrete criado no passado | Só é elegível se `updatedAt < remindAt`; portanto, salvar uma data já vencida (`updatedAt >= remindAt`) não dispara push | Implementa a decisão de `notes`: a API aceita a data passada, mas `reminders` a ignora |
| Nota alterada após vencer | Antes de cada tentativa, a fonte confirma que a nota existe, não está arquivada, ainda tem o mesmo `remindAt` e `updatedAt < remindAt`; caso contrário, a entrega é cancelada | Não envia um lembrete obsoleto após editar, limpar, arquivar ou excluir a nota |
| Novos dispositivos | Uma assinatura só recebe lembretes cujo `remindAt >= subscription.createdAt` | Ativar notificações não despeja lembretes anteriores no novo dispositivo |
| Fan-out | Cada par assinatura + nota + horário gera uma entrega; todas as assinaturas ativas recebem | Cada navegador é independente e o app é de um único usuário |
| Idempotência | Índice único `(noteId, scheduledFor, subscriptionId)`; ticks repetidos reutilizam a mesma entrega | Evita duplicata no funcionamento normal sem exigir fila externa |
| Semântica de entrega | **Pelo menos uma vez**, com deduplicação de melhor esforço. Crash depois do push e antes do `sent` ainda pode duplicar | Push services não oferecem transação com o Postgres; prometer exatamente uma vez seria falso |
| Colapso visual | `topic` do Web Push e `NotificationOptions.tag` são estáveis por nota | Push ainda pendente ou duplicado substitui o anterior quando o navegador suporta |
| Retry | Até 3 tentativas: imediata, +1 min e +5 min. Rede, `408`, `429` e `5xx` são transitórios; demais `4xx` falham sem retry | Recupera falhas breves sem manter uma fila infinita |
| Assinatura expirada | `404` ou `410` remove a assinatura e suas entregas por cascade | O push service declarou o endpoint inutilizável |
| Conteúdo | Payload JSON pequeno: `{ title: "Lembrete", body, url, tag }`; `body` é o título da nota ou `Toque para abrir a nota.` | Útil sem expor o corpo markdown na tela bloqueada e muito abaixo do limite de payload |
| Permissão | Nunca pedir no load. `Notification.requestPermission()` só roda após clique em "Ativar notificações" | Evita prompt intrusivo e atende a exigência de interação do usuário em plataformas como iOS |
| Reconciliação | Com permissão concedida, o app consulta `pushManager.getSubscription()` no client após hidratar e faz upsert silencioso se houver assinatura | Restaura o vínculo da API após limpeza/redeploy sem pedir permissão de novo |
| Desativação | Primeiro a API remove o registro; depois o browser chama `unsubscribe()`. Falha da API mantém a assinatura e mostra erro para tentar novamente | Evita um endpoint ativo no servidor sem forma local simples de identificá-lo |
| Compatibilidade | Feature detection de `serviceWorker`, `PushManager` e `Notification`; sem sniffing de browser | O padrão é interoperável e diferenças de plataforma aparecem como estado da UI |
| iOS/iPadOS | A UI explica que Web Push exige o app adicionado à Tela de Início; o botão continua condicionado à detecção real das APIs | Web Push existe para Home Screen web apps desde iOS/iPadOS 16.4 |
| Service worker | `/sw.js`, escopo `/`, só trata `push` e `notificationclick`; não registra handler de `fetch` | PWA instalável e push sem inventar suporte offline |
| Manifest | `/app.webmanifest`: `id: "/"`, `start_url: "/notes"`, `scope: "/"`, `display: "standalone"`, nome `septo`, idioma `pt-BR`, cores do tema e ícones 192/512 maskable + apple-touch 180 | Identidade consistente e instalação nos navegadores alvo |
| Chaves VAPID em dev | Par fixo e explicitamente dev-only como default fora de produção; em produção as três variáveis VAPID são obrigatórias | Codegen/testes continuam subindo sem `.env`, enquanto produção não reutiliza chave pública |
| Rotação VAPID | Não é automática. Trocar o par invalida assinaturas existentes e exige nova permissão/reassinatura na prática | A chave pública faz parte da assinatura criada pelo browser |
| Observabilidade | Log estruturado por tick com contagens; por falha, somente ids internos, host do push service e status HTTP | Diagnóstico sem vazar endpoint, chaves, título ou corpo da nota |

### Fluxo do scheduler

```text
tick (now)
  → notes.ReminderSource.listDue(now - 24 h, now, 100)
  → para cada candidato, cria entregas ausentes para assinaturas criadas antes do horário
  → carrega até 100 entregas pending/retry com nextAttemptAt <= now
  → reconfirma a nota e o horário com ReminderSource
  → envia fora da transação
  → sent | retry(nextAttemptAt) | failed | canceled
```

O tick tem trava em memória e o índice único protege materialização repetida. A spec suporta uma instância da API; antes de escalar horizontalmente, substituir a trava local por claim transacional (`FOR UPDATE SKIP LOCKED`) ou fila externa.

## Contrato com `notes`

O contrato canônico pertence ao módulo provedor e está em [SPEC-notes — Contrato fornecido a `reminders`](SPEC-notes.md#contrato-fornecido-a-reminders). Não existe endpoint HTTP novo: `RemindersModule` importa `NotesModule` e injeta o `ReminderSource` exportado. O adapter concreto, o `NoteRepository` e o Prisma de notas continuam privados.

## Contrato da API

Todas as rotas ficam sob `/api`, são protegidas pelo `AuthGuard` global e usam o erro padrão `{ code, message }`. O scheduler não é exposto por HTTP.

| Método e rota | Handler (operationId) | Entrada | Sucesso | Erros |
|---|---|---|---|---|
| `GET /push/config` | `pushGetConfig` | — | `200 { publicKey: string }` | `401` |
| `PUT /push/subscriptions` | `pushUpsertSubscription` | `PushSubscriptionInput` | `200 { id: uuid }` | `400`, `401`, `422 INVALID_PUSH_SUBSCRIPTION` |
| `DELETE /push/subscriptions/:id` | `pushDeleteSubscription` | `id: uuid` | `204` (também se já não existir) | `400`, `401` |

```ts
// PushSubscriptionInput
{
  endpoint: string; // URL https, no máximo 2.048 caracteres
  expirationTime: number | null; // epoch em ms, como PushSubscription.toJSON()
  keys: {
    p256dh: string; // base64url, no máximo 256 caracteres
    auth: string;   // base64url, no máximo 128 caracteres
  };
}
```

O `PUT` é idempotente por `endpoint`: uma repetição devolve o mesmo `id` e atualiza chaves, expiração e `updatedAt`. `endpoint`, `p256dh` e `auth` são aceitos somente no request e nunca aparecem numa resposta ou log.

## Modelo de dados

```prisma
enum ReminderDeliveryStatus {
  pending
  retry
  sent
  failed
  canceled
}

model PushSubscription {
  id             String   @id @default(uuid()) @db.Uuid
  endpoint       String   @unique
  p256dh         String
  auth           String
  expirationTime DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deliveries     ReminderDelivery[]

  @@map("push_subscriptions")
}

model ReminderDelivery {
  id               String                 @id @default(uuid()) @db.Uuid
  noteId           String                 @db.Uuid
  scheduledFor     DateTime
  subscriptionId   String                 @db.Uuid
  subscription     PushSubscription       @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  status           ReminderDeliveryStatus @default(pending)
  attempts         Int                    @default(0)
  nextAttemptAt    DateTime
  lastStatusCode   Int?
  sentAt           DateTime?
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  @@unique([noteId, scheduledFor, subscriptionId])
  @@index([status, nextAttemptAt])
  @@map("reminder_deliveries")
}
```

`noteId` não tem foreign key para `notes`: a fronteira é `ReminderSource`, e a validação antes do envio cancela órfãos. Entregas antigas podem ser limpas depois por uma política de retenção; na v1 o volume pessoal é desprezível e nenhuma rotina de purge será criada.

## Variáveis de ambiente

| Variável | Default dev | Uso |
|---|---|---|
| `VAPID_PUBLIC_KEY` | chave pública fixa dev-only | Entregue ao browser e usada pelo sender |
| `VAPID_PRIVATE_KEY` | chave privada fixa dev-only | Assina os requests Web Push; nunca sai da API |
| `VAPID_SUBJECT` | `mailto:dev@septo.local` | Contato VAPID; aceita `mailto:` ou URL `https:` |

Em `NODE_ENV=production`, as três são obrigatórias, a chave privada não pode ser igual ao default de desenvolvimento e o boot falha rápido se o par for inválido. `.env.example` documenta como gerar as chaves, mas não contém a chave privada de produção.

## Project Structure

```text
apps/api/src/modules/notes/
  domain/reminder-source.ts                    contrato provedor
  infrastructure/prisma-reminder-source.ts     leitura dos candidatos
  notes.module.ts                              exporta ReminderSource

apps/api/src/modules/reminders/
  domain/          push-subscription.ts, reminder-delivery.ts,
                   push-subscription.repository.ts, reminder-delivery.repository.ts,
                   push-sender.ts, notification-copy.ts
  application/     get-push-config.use-case.ts, upsert-push-subscription.use-case.ts,
                   delete-push-subscription.use-case.ts, dispatch-due-reminders.use-case.ts
  infrastructure/  *.prisma-repository.ts, web-push.sender.ts, reminder-scheduler.service.ts
  presentation/    push.controller.ts, push.schemas.ts
  testing/         fakes.ts
  reminders.module.ts

apps/web/public/
  app.webmanifest, sw.js
  icons/pwa-192.png, icons/pwa-512.png, icons/pwa-maskable-512.png, icons/apple-touch-180.png

apps/web/src/features/reminders/
  domain/       push-support.ts, subscription-input.ts
  components/   notification-settings.tsx, pwa-install-help.tsx
  push-client.ts

apps/web/src/routes/__root.tsx                  manifest/meta/icons + registro client-only do SW
apps/web/src/routes/_app/settings.tsx           seção Notificações
apps/web/e2e/reminders.spec.ts
```

## Code Style

```ts
@Injectable()
export class DispatchDueRemindersUseCase {
  constructor(
    private readonly source: ReminderSource,
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly deliveries: ReminderDeliveryRepository,
    private readonly sender: PushSender,
  ) {}

  async execute(now = new Date()): Promise<DispatchSummary> {
    const candidates = await this.source.listDue({
      after: new Date(now.getTime() - RECOVERY_WINDOW_MS),
      through: now,
      limit: DISPATCH_BATCH_SIZE,
    });

    await this.deliveries.materialize(candidates, await this.subscriptions.listActive(), now);
    return this.dispatchReady(now);
  }
}
```

Além das convenções globais:

- o nome do domínio é `push subscription`; `Subscription` sozinho é ambíguo;
- instantes internos são `Date`; epoch em ms existe só no DTO recebido do browser;
- constantes de política (`60 s`, `24 h`, batch `100`, retries) têm nome e teste, não números espalhados;
- o sender recebe um payload já montado e não conhece `Note`;
- o scheduler só controla tempo/ciclo de vida e chama o caso de uso; regra de retry não fica no provider Nest;
- o service worker valida o payload e usa fallbacks antes de chamar `showNotification`.

## Testing Strategy

| Nível | Cobre |
|---|---|
| Unit (API) | Validação/normalização da assinatura; cópia da notificação com e sem título; materialização para todas as assinaturas elegíveis; índice lógico por nota/horário/assinatura; data passada criada agora ignorada; janela de 24 h; nota arquivada, excluída, limpa ou reagendada cancela; sucesso; retry em rede/`408`/`429`/`5xx`; falha permanente; remoção em `404`/`410`; máximo de 3 tentativas; relógio fixo |
| Unit (`notes`) | `ReminderSource.listDue` filtra limite, janela, arquivadas e `updatedAt < remindAt`; `findCurrent` compara o horário exato e invalida mudanças posteriores |
| Unit (web) | Feature detection; máquina de estados `unsupported/default/denied/enabled`; conversão de `PushSubscription.toJSON()` para o DTO; reconciliação não chama `requestPermission`; desativação preserva assinatura se a API falhar |
| Integração (API) | Endpoints protegidos; upsert idempotente; delete idempotente; segredos ausentes da resposta; Postgres materializa uma entrega só em ticks repetidos; scheduler com `PushSender` fake entrega e persiste status/retry |
| Contrato | `openapi.json` regenerado e commitado; client Orval expõe config/upsert/delete com os tipos corretos |
| E2E automatizado | Configurações mostra estados de suporte/permissão; prompt só nasce do clique; assinatura mockada é enviada à API e reconciliada no reload; desativação remove a assinatura; manifest, ícones e `/sw.js` respondem; clique simulado navega para a nota |
| Smoke manual | Push real com app fechado em Chromium desktop, Chrome Android, Safari macOS e PWA na Tela de Início do iOS/iPadOS; notificação recebida, clique abre a nota e endpoint expirado é removido |

Meta: ≥ 90% de linhas em `domain/` e `application/` de `reminders`, como nos módulos anteriores. O e2e não depende de um push service externo; envio real fica no smoke manual porque FCM/APNs/Mozilla, permissões do SO e entrega em background tornariam o CI não determinístico.

## Boundaries

- **Sempre:** pedir permissão somente após gesto explícito; validar a assinatura com zod e exigir endpoint `https:`; tratar endpoint e chaves como credenciais; reconfirmar a nota antes de cada tentativa; manter o envio fora da transação do banco; usar o client Orval no web; regenerar e commitar `openapi.json`; validar em HTTPS real no smoke manual.
- **Perguntar antes:** mudar a janela de 24 h, retries ou frequência de 1 min; mostrar corpo da nota no push; adicionar botão de teste; girar as chaves VAPID; criar allowlist de push services; adicionar cache/offline/Workbox; suportar múltiplas instâncias; adicionar dependência além de `web-push`/tipos; criar recorrência.
- **Nunca:** pedir permissão no carregamento da página; expor/logar `VAPID_PRIVATE_KEY`, endpoint, `p256dh`, `auth` ou conteúdo da nota; aceitar endpoint HTTP; consultar Prisma de `notes` dentro de `reminders`; alterar/limpar `remindAt` depois do envio; prometer exatamente uma vez; interceptar `fetch` no service worker sem uma spec de cache e atualização.

## Success Criteria

1. Sem sessão, os três endpoints respondem `401`; com sessão, `GET /api/push/config` expõe somente a chave pública.
2. A tela de Configurações não pede permissão sozinha. Um clique em "Ativar notificações" registra `/sw.js`, pede permissão, chama `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` e persiste a assinatura.
3. Repetir o `PUT` para o mesmo endpoint devolve o mesmo `id`, atualiza as chaves e mantém uma única linha. Nenhuma resposta ou log contém endpoint, `p256dh`, `auth` ou chave privada.
4. Dois dispositivos inscritos antes do horário geram exatamente duas entregas. Um dispositivo inscrito depois do horário não recebe aquele lembrete.
5. Uma nota não arquivada agendada para o futuro gera push entre o horário marcado e o segundo tick seguinte (até 2 min em operação normal), uma vez por assinatura em ticks normais.
6. Data já passada no momento do save, nota arquivada/excluída, `remindAt` limpo ou horário alterado antes do envio não dispara a notificação antiga.
7. Após indisponibilidade, um lembrete vencido há até 24 h e que já estava agendado no futuro é recuperado; um vencido há mais de 24 h é ignorado.
8. Falha transitória segue a política de 3 tentativas; `404`/`410` remove a assinatura; outro `4xx` termina como `failed` sem loop infinito.
9. O push mostra `Lembrete` e o título da nota, sem o corpo markdown. Clicar foca uma janela existente ou abre `/notes/<id>` em nova janela.
10. Desativar remove apenas a assinatura atual da API e chama `unsubscribe()` no browser; os demais dispositivos continuam ativos.
11. `/app.webmanifest` declara identidade, `standalone`, escopo, start URL e ícones; `/sw.js` controla o escopo `/` sem handler de `fetch`; o app é instalável nos navegadores alvo.
12. Em iOS/iPadOS, a UI orienta instalação na Tela de Início quando as APIs não estão disponíveis no contexto atual e nunca finge que a assinatura foi ativada.
13. Produção não inicia sem VAPID válido; desenvolvimento, codegen e testes iniciam com o par dev-only.
14. `lint`, `check-types`, `build`, `test` e `test:e2e` passam; `openapi.json`, `.env.example`, README, a extensão de `SPEC-notes` e CAPABILITY-MAP estão atualizados.

## Riscos

| Risco | Mitigação |
|---|---|
| Push é best-effort e depende de FCM/APNs/Mozilla, rede, bateria e permissões do SO | UI não promete pontualidade exata; scheduler mede tentativa, não leitura; smoke manual cobre plataformas reais |
| Crash depois do envio e antes de persistir `sent` duplica | Semântica at-least-once explícita, índice único, `topic` e `tag` estáveis reduzem duplicata visível |
| Datas já vencidas seriam reenviadas a cada tick | Janela limitada, regra `updatedAt < remindAt` e ledger único por horário |
| Alterar título/corpo também muda `updatedAt` | Antes do vencimento continua elegível (`updatedAt < remindAt`); no/pós-vencimento a edição cancela a entrega antiga deliberadamente |
| Rotação da chave pública quebra assinaturas existentes | Rotação manual, pede aprovação e inclui plano de reassinatura |
| Endpoint é uma capability URL e pode virar vetor de SSRF se aceito de cliente arbitrário | Endpoint exige HTTPS, rota autenticada de usuário único, payload/segredos nunca são logados; reavaliar allowlist/resolução de IP se houver multiusuário |
| Service worker antigo permanece ativo | Arquivo pequeno, sem cache; `install` chama `skipWaiting`, `activate` chama `clients.claim`, e a reconciliação ocorre a cada load |
| Testar push real no CI é instável | Sender fake nos testes determinísticos; smoke manual obrigatório antes de fechar o módulo |
| A tabela de entregas cresce sem purge | Volume de usuário único aceito na v1; `// ponytail:` para retenção quando o banco justificar |

## Open Questions

Nenhuma. Recuperação de até 24 horas, fan-out para todos os dispositivos ativos e notificação com apenas o título da nota foram aprovados em 2026-09-21.

## Referências

- [MDN — PushSubscription](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription)
- [WebKit — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [web.dev — Web app manifest](https://web.dev/learn/pwa/web-app-manifest)
- [web-push — implementação Node e VAPID](https://github.com/web-push-libs/web-push)
