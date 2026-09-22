# Tarefas: reminders

> Plano: [plan.md](plan.md) · Spec: [SPEC-reminders](../../specs/SPEC-reminders.md)
> Branch prevista: `feat/reminders` · um commit por tarefa (Conventional Commits, em inglês).
> Regra geral: toda tarefa termina com `npm run lint`, `npm run check-types` e `npm run test` passando, com `docker compose up -d` quando houver teste de banco.
> Só T10 muda rota da API: ela roda `npm run codegen` e commita `apps/api/openapi.json`. Código gerado do Orval continua gitignored e nunca é editado à mão.
> Camadas: Prisma só em `infrastructure`; `domain` sem framework; imports relativos da API terminam em `.js`; `reminders` nunca consulta Prisma de `notes`.

---

## Fase 1: riscos e fronteiras

### T1: Dependência `web-push` e configuração VAPID validada ⚠️ risco externo

**Descrição:** Instalar `web-push@3.6.7` e `@types/web-push@3.6.4`; ampliar o env da API com `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`. Dev/test/codegen recebem um par fixo dev-only; produção exige valores próprios e válidos. Documentar em `.env.example` o comando que gera o par sem escrever segredo no repo.

**Acceptance criteria:**

- [x] `parseEnv` aceita ausência das três variáveis fora de produção e devolve o trio dev-only; produção sem qualquer uma delas falha com mensagem por campo.
- [x] Produção rejeita o par dev-only, chave malformada e subject fora de `mailto:`/`https:`; valores válidos chegam tipados pelo token `ENV`.
- [x] `web-push` e seus tipos ficam nas seções corretas do `apps/api/package.json`, com lockfile consistente e instrução segura em `.env.example`.

**Verification:**

- [x] `npm run test -w @septo/api -- env.spec.ts`
- [x] `npm exec --workspace @septo/api -- web-push generate-vapid-keys --json` imprime JSON com duas chaves.
- [x] Definition of Done global (`lint`, `check-types`, `test`).

**Dependencies:** nenhuma

**Files likely touched:**

- `apps/api/package.json`
- `package-lock.json`
- `apps/api/src/shared/env.ts`
- `apps/api/src/shared/env.spec.ts`
- `.env.example`

**Estimated scope:** M (5 arquivos)

---

### T2: Porta `PushSender` e adapter `web-push` ⚠️ risco externo

**Descrição:** Definir no domínio a porta de envio e um resultado fechado (`sent`, `gone`, `transient`, `permanent`). Implementar o adapter que configura VAPID uma vez, limita TTL/topic e transforma sucesso, erro de rede e status HTTP nas categorias consumidas pelo caso de uso — sem logar subscription nem payload.

**Acceptance criteria:**

- [ ] `PushSender.send(subscription, payload)` não conhece Prisma/Nest e devolve um resultado discriminado com `statusCode?`, sem lançar para respostas esperadas.
- [ ] Adapter envia JSON com TTL de 24 h, urgência normal e topic estável; `404`/`410` → `gone`, rede/`408`/`429`/`5xx` → `transient`, demais `4xx` → `permanent`.
- [ ] Import ESM/SWC e tipos do pacote funcionam no build da API; testes mockam a chamada externa sem fazer rede.

**Verification:**

- [ ] `npm run test -w @septo/api -- web-push.sender.spec.ts`
- [ ] `npm run build -w @septo/api`
- [ ] Definition of Done global.

**Dependencies:** T1

**Files likely touched:**

- `apps/api/src/modules/reminders/domain/push-sender.ts`
- `apps/api/src/modules/reminders/infrastructure/web-push.sender.ts`
- `apps/api/src/modules/reminders/infrastructure/web-push.sender.spec.ts`

**Estimated scope:** M (3 arquivos)

---

### T3: `ReminderSource` fornecido por `notes` ⚠️ fronteira entre módulos

**Descrição:** Implementar dentro de `notes` o contrato aprovado na spec: tipo `ReminderCandidate`, porta `ReminderSource`, adapter Prisma e export pelo `NotesModule`. É uma leitura dedicada; não ampliar `NoteRepository` nem criar endpoint HTTP.

**Acceptance criteria:**

- [ ] `listDue({ after, through, limit })` traz somente não arquivadas com `remindAt` na janela e `updatedAt < remindAt`, em ordem ascendente e com `take` no banco.
- [ ] `findCurrent(id, scheduledFor)` devolve `null` para id inválido/inexistente, arquivada, horário diferente ou atualização no/pós-vencimento; comparação usa instante.
- [ ] `NotesModule` exporta `ReminderSource`; o adapter concreto e `NoteRepository` permanecem privados.

**Verification:**

- [ ] `npm run test -w @septo/api -- prisma-reminder-source.spec.ts`
- [ ] `rg "generated/prisma" apps/api/src/modules/notes/domain/reminder-source.ts` não encontra import.
- [ ] Definition of Done global.

**Dependencies:** nenhuma

**Files likely touched:**

- `apps/api/src/modules/notes/domain/reminder-source.ts`
- `apps/api/src/modules/notes/infrastructure/prisma-reminder-source.ts`
- `apps/api/src/modules/notes/infrastructure/prisma-reminder-source.spec.ts`
- `apps/api/src/modules/notes/notes.module.ts`

**Estimated scope:** M (4 arquivos)

---

## Checkpoint A: integrações externas provadas

- [ ] API ESM/SWC importa `web-push@3.6.7` e o adapter classifica todos os resultados sem rede real.
- [ ] Produção falha sem VAPID próprio; dev/test/codegen continuam funcionando sem `.env` extra.
- [ ] `ReminderSource` cumpre a janela temporal e a direção `reminders → notes` sem vazamento de Prisma.
- [ ] `npm run lint`, `npm run check-types`, `npm run test` e build da API verdes.
- [ ] Revisão humana antes da Fase 2.

---

## Fase 2: persistência e despacho

### T4: Models Prisma e migration de assinaturas/entregas

**Descrição:** Adicionar `PushSubscription`, `ReminderDelivery` e `ReminderDeliveryStatus` exatamente como na spec, com unique de idempotência, índice da fila e cascade somente da assinatura para entregas. Gerar uma migration única do módulo.

**Acceptance criteria:**

- [ ] Schema contém os dois models, enum, nomes de tabela, UUIDs, unique `(noteId, scheduledFor, subscriptionId)` e índice `(status, nextAttemptAt)`.
- [ ] `noteId` não tem relation/FK para `Note`; deletar assinatura remove suas entregas por cascade.
- [ ] Migration aplica do zero em `septo_test` e o Prisma Client gerado expõe models/enum tipados.

**Verification:**

- [ ] `npm run db:migrate -w @septo/api` e `npm run db:generate -w @septo/api`.
- [ ] `npm run test -w @septo/api` com o `globalSetup` aplicando todas as migrations do zero.
- [ ] Definition of Done global.

**Dependencies:** nenhuma

**Files likely touched:**

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/<timestamp>_create_reminders/migration.sql`

**Estimated scope:** S (2 arquivos)

---

### T5: Fatia de persistência de `PushSubscription`

**Descrição:** Criar entidade/restauração de assinatura, porta de repositório e adapter Prisma. O upsert é idempotente por endpoint e atualiza keys/expiração sem mudar `createdAt`; consultas de fan-out ignoram expiração já vencida.

**Acceptance criteria:**

- [ ] Domínio valida URL HTTPS, limites/base64url de `p256dh` e `auth`, e converte epoch recebido na borda para `Date | null` antes de persistir.
- [ ] Repositório implementa `upsert`, `findById`, `listActiveAt(at)` e `delete`; mesmo endpoint mantém o id e `createdAt` e atualiza dados mutáveis.
- [ ] Teste Postgres cobre upsert repetido, expiração, delete idempotente e garante que resposta de domínio não oferece serialização acidental dos segredos.

**Verification:**

- [ ] `npm run test -w @septo/api -- push-subscription`
- [ ] `rg "generated/prisma" apps/api/src/modules/reminders/domain` não encontra import.
- [ ] Definition of Done global.

**Dependencies:** T4

**Files likely touched:**

- `apps/api/src/modules/reminders/domain/push-subscription.ts`
- `apps/api/src/modules/reminders/domain/push-subscription.spec.ts`
- `apps/api/src/modules/reminders/domain/push-subscription.repository.ts`
- `apps/api/src/modules/reminders/infrastructure/push-subscription.prisma-repository.ts`
- `apps/api/src/modules/reminders/infrastructure/push-subscription.prisma-repository.spec.ts`

**Estimated scope:** M (5 arquivos)

---

### T6: Fatia de persistência de `ReminderDelivery`

**Descrição:** Modelar o lifecycle da entrega e seu repositório: materialização idempotente, busca dos itens prontos, `sent`, `retry`, `failed`, `canceled` e remoção de assinatura expirada. Política temporal continua fora do adapter.

**Acceptance criteria:**

- [ ] Entidade controla transições e tentativas; retry define `nextAttemptAt`, sucesso define `sentAt`, estados terminais não voltam a pending.
- [ ] `materialize` tolera corrida pelo unique, cria somente pares ausentes e `listReady(now, limit)` retorna `pending/retry` vencidos na ordem correta.
- [ ] Adapter persiste todas as transições e o teste real prova unique, índice lógico, cascade e limite de batch.

**Verification:**

- [ ] `npm run test -w @septo/api -- reminder-delivery`
- [ ] `npm run coverage -w @septo/api` inclui domínio da entrega acima da meta do módulo.
- [ ] Definition of Done global.

**Dependencies:** T4

**Files likely touched:**

- `apps/api/src/modules/reminders/domain/reminder-delivery.ts`
- `apps/api/src/modules/reminders/domain/reminder-delivery.spec.ts`
- `apps/api/src/modules/reminders/domain/reminder-delivery.repository.ts`
- `apps/api/src/modules/reminders/infrastructure/reminder-delivery.prisma-repository.ts`
- `apps/api/src/modules/reminders/infrastructure/reminder-delivery.prisma-repository.spec.ts`

**Estimated scope:** M (5 arquivos)

---

### T7: Caso de uso de despacho, fan-out, idempotência e retries

**Descrição:** Implementar `DispatchDueRemindersUseCase` em TDD contra fakes. Um tick busca candidatos das últimas 24 h, materializa uma entrega por assinatura criada até o horário, reconfirma a nota, envia fora da persistência e aplica a política de retry. A cópia do push é uma função pura separada.

**Acceptance criteria:**

- [ ] Tick repetido não duplica; fan-out inclui todas as assinaturas elegíveis e exclui as criadas depois de `scheduledFor`; batch é 100.
- [ ] Candidato obsoleto vira `canceled`; sucesso vira `sent`; `gone` remove assinatura; transitório usa imediata/+1 min/+5 min até 3 tentativas; permanente vira `failed`.
- [ ] Payload contém apenas `Lembrete`, título da nota/fallback, URL interna e tag; fake prova que `send` acontece depois das operações de materialização/leitura, sem transação aberta.

**Verification:**

- [ ] `npm run test -w @septo/api -- dispatch-due-reminders.use-case.spec.ts`
- [ ] `npm run coverage -w @septo/api` mostra ≥ 90% em `modules/reminders/{domain,application}`.
- [ ] Definition of Done global.

**Dependencies:** T2, T3, T5, T6

**Files likely touched:**

- `apps/api/src/modules/reminders/application/dispatch-due-reminders.use-case.ts`
- `apps/api/src/modules/reminders/application/dispatch-due-reminders.use-case.spec.ts`
- `apps/api/src/modules/reminders/domain/notification-copy.ts`
- `apps/api/src/modules/reminders/domain/notification-copy.spec.ts`
- `apps/api/src/modules/reminders/testing/fakes.ts`

**Estimated scope:** M (5 arquivos)

---

### T8: Scheduler de 60 s e wiring do módulo

**Descrição:** Criar `RemindersModule` e um provider de ciclo de vida: tick imediato no bootstrap, depois a cada 60 s, sem sobreposição, com `unref()` e limpeza no shutdown. Ligar portas aos adapters, importar/exportar apenas o necessário e registrar no `AppModule`.

**Acceptance criteria:**

- [ ] Bootstrap chama o caso de uso uma vez; intervalo usa 60 s; tick sobreposto é ignorado; erro é logado sem matar os próximos ticks.
- [ ] Shutdown sempre limpa o timer; testes com fake timers não deixam handles abertos nem acessam rede/banco.
- [ ] `RemindersModule` importa `NotesModule`, resolve todas as portas/adapters e o app sobe sem erro de DI.

**Verification:**

- [ ] `npm run test -w @septo/api -- reminder-scheduler.service.spec.ts`
- [ ] `npm run build -w @septo/api` e smoke de bootstrap sem erro de DI.
- [ ] Definition of Done global.

**Dependencies:** T7

**Files likely touched:**

- `apps/api/src/modules/reminders/infrastructure/reminder-scheduler.service.ts`
- `apps/api/src/modules/reminders/infrastructure/reminder-scheduler.service.spec.ts`
- `apps/api/src/modules/reminders/reminders.module.ts`
- `apps/api/src/app.module.ts`

**Estimated scope:** M (4 arquivos)

---

## Checkpoint B: scheduler completo sem HTTP

- [ ] Tick cria uma entrega por assinatura e não duplica no tick seguinte.
- [ ] Passado criado agora, obsoleto, arquivado/excluído e atraso > 24 h não enviam.
- [ ] Sucesso/retry/falha/gone persistem corretamente; sender nunca roda dentro da transação.
- [ ] Scheduler inicia/para limpo, sem tick sobreposto nem handle pendurado.
- [ ] `lint`, `check-types`, `test`, build e coverage verdes.

---

## Fase 3: contrato HTTP e assinatura no navegador

### T9: Casos de uso de config, upsert e remoção da assinatura

**Descrição:** Criar os três casos de uso que sustentam a borda HTTP. `GetPushConfig` devolve só a chave pública; `UpsertPushSubscription` converte/valida e devolve só o id; `DeletePushSubscription` é idempotente.

**Acceptance criteria:**

- [ ] Config nunca expõe subject ou chave privada; retorno é `{ publicKey }`.
- [ ] Upsert retorna `{ id }`, mantém id estável para o endpoint e converte `expirationTime` epoch/null corretamente.
- [ ] Delete de id existente ou ausente conclui sem erro; validação vira `INVALID_PUSH_SUBSCRIPTION`, nunca erro Prisma.

**Verification:**

- [ ] `npm run test -w @septo/api -- push-subscription.use-cases.spec.ts`
- [ ] Coverage de `application/` continua ≥ 90%.
- [ ] Definition of Done global.

**Dependencies:** T5

**Files likely touched:**

- `apps/api/src/modules/reminders/application/get-push-config.use-case.ts`
- `apps/api/src/modules/reminders/application/upsert-push-subscription.use-case.ts`
- `apps/api/src/modules/reminders/application/delete-push-subscription.use-case.ts`
- `apps/api/src/modules/reminders/application/push-subscription.use-cases.spec.ts`

**Estimated scope:** M (4 arquivos)

---

### T10: Controller, schemas, integração HTTP, OpenAPI e Orval

**Descrição:** Implementar `PushController` e schemas zod para as três operações aprovadas. Registrar casos de uso/controller no módulo, testar autenticação/validação/segredos com Postgres real e regenerar o contrato/OpenAPI para o web.

**Acceptance criteria:**

- [ ] `GET /api/push/config`, `PUT /api/push/subscriptions` e `DELETE /api/push/subscriptions/:id` têm operationIds/status/erros da spec e nenhum `@Public()`.
- [ ] Endpoint exige HTTPS e limites/base64url; delete é 204 idempotente; respostas e snapshots nunca contêm endpoint/keys/private key.
- [ ] `openapi.json` gerado passa no teste de contrato e Orval produz funções/hooks tipados para config/upsert/delete.

**Verification:**

- [ ] `npm run test -w @septo/api -- reminders.spec.ts`
- [ ] `npm run codegen && npm run check-types`
- [ ] Definition of Done global, incluindo `git diff --exit-code -- apps/api/openapi.json` depois de regenerar pela segunda vez.

**Dependencies:** T8, T9

**Files likely touched:**

- `apps/api/src/modules/reminders/presentation/push.controller.ts`
- `apps/api/src/modules/reminders/presentation/push.schemas.ts`
- `apps/api/src/modules/reminders/reminders.module.ts`
- `apps/api/test/reminders.spec.ts`
- `apps/api/openapi.json`

**Estimated scope:** M (5 arquivos)

---

### T11: Domínio/client web de assinatura

**Descrição:** Criar lógica client-only testável para detectar suporte/estado, converter `PushSubscription.toJSON()` para o DTO e coordenar ativação, reconciliação e desativação usando somente o client Orval gerado. Nenhum browser global é tocado durante SSR/import.

**Acceptance criteria:**

- [ ] Estado puro distingue `unsupported`, `default`, `denied` e `enabled`; feature detection usa APIs, não user-agent.
- [ ] Ativação registra/obtém SW, pede permissão somente dentro da ação, assina com a public key e faz upsert; reconciliação com permissão concedida nunca chama `requestPermission`.
- [ ] Desativação remove na API antes de `unsubscribe`; falha da API mantém a assinatura e devolve erro exibível, sem afetar outros browsers.

**Verification:**

- [ ] `npm run test -w @septo/web -- src/features/reminders`
- [ ] `npm run build -w @septo/web` prova que SSR não avalia browser globals.
- [ ] Definition of Done global.

**Dependencies:** T10

**Files likely touched:**

- `apps/web/src/features/reminders/domain/push-support.ts`
- `apps/web/src/features/reminders/domain/push-support.spec.ts`
- `apps/web/src/features/reminders/domain/subscription-input.ts`
- `apps/web/src/features/reminders/domain/subscription-input.spec.ts`
- `apps/web/src/features/reminders/push-client.ts`

**Estimated scope:** M (5 arquivos)

---

### T12: Configurações → Notificações e ajuda de instalação

**Descrição:** Adicionar à página de Configurações uma seção client-only que apresenta o estado deste navegador e executa o fluxo de T11. Em iOS/contexto sem Push, mostrar orientação curta para instalar na Tela de Início sem fingir suporte detectado.

**Acceptance criteria:**

- [ ] Estado disponível mostra "Ativar notificações"; ativo mostra "Desativar"; denied explica como liberar nas configurações do navegador/SO; unsupported não oferece ação impossível.
- [ ] Loading, sucesso e erro têm feedback em PT-BR, botões não duplicam mutação e a permissão só é pedida por clique.
- [ ] A seção usa `SettingRow`, funciona por teclado, não gera mismatch SSR e mantém Conta/Aparência existentes intactas.

**Verification:**

- [ ] `npm run test -w @septo/web -- notification-settings.spec.tsx`
- [ ] Manual em `/settings` com estados mockados e em 375 px, claro/escuro.
- [ ] Definition of Done global.

**Dependencies:** T11

**Files likely touched:**

- `apps/web/src/features/reminders/components/notification-settings.tsx`
- `apps/web/src/features/reminders/components/notification-settings.spec.tsx`
- `apps/web/src/features/reminders/components/pwa-install-help.tsx`
- `apps/web/src/routes/_app/settings.tsx`

**Estimated scope:** M (4 arquivos)

---

## Checkpoint C: assinatura ponta a ponta

- [ ] Prompt nasce só de clique; reload reconcilia sem novo prompt.
- [ ] Upsert é idempotente e nenhuma resposta/log expõe segredo.
- [ ] Desativação remove só o browser atual e preserva a assinatura se a API falhar.
- [ ] Quatro estados aparecem corretamente na UI, inclusive orientação iOS.
- [ ] `openapi.json`, codegen, `lint`, `check-types`, `test` e builds verdes.
- [ ] Revisão humana antes da PWA/fechamento.

---

## Fase 4: PWA e fechamento

### T13: Manifest e conjunto de ícones PWA

**Descrição:** Criar identidade estática instalável: manifest com escopo/start URL/display/cores/idioma e ícones 192, 512, maskable 512 e apple-touch 180. Os assets seguem o visual septo e têm dimensões/formato reais correspondentes aos nomes.

**Acceptance criteria:**

- [ ] Manifest contém `id: "/"`, `start_url: "/notes"`, `scope: "/"`, `display: "standalone"`, `lang: "pt-BR"`, nome/short name e cores coerentes.
- [ ] Ícones PNG têm exatamente 192×192, 512×512, 512×512 maskable com safe zone e 180×180; manifest referencia os três aplicáveis.
- [ ] Assets respondem com MIME correto no dev server e o manifest passa na inspeção do Chromium sem erro.

**Verification:**

- [ ] `file apps/web/public/icons/*.png` confirma formato/dimensões.
- [ ] `npm run build -w @septo/web` inclui manifest e assets na saída.
- [ ] Definition of Done global.

**Dependencies:** nenhuma

**Files likely touched:**

- `apps/web/public/app.webmanifest`
- `apps/web/public/icons/pwa-192.png`
- `apps/web/public/icons/pwa-512.png`
- `apps/web/public/icons/pwa-maskable-512.png`
- `apps/web/public/icons/apple-touch-180.png`

**Estimated scope:** M (5 arquivos)

---

### T14: Service worker, registro client-only e click para a nota

**Descrição:** Implementar `/sw.js` sem cache/fetch: lifecycle imediato, payload defensivo, `showNotification`, e click que foca/navega uma janela same-origin ou abre a URL. Ligar manifest/meta/icons no root e registrar o SW somente depois da hidratação.

**Acceptance criteria:**

- [ ] `push` aceita payload válido e usa fallbacks seguros em payload ausente/inválido; título/body/tag/icon/data.url seguem a spec.
- [ ] `notificationclick` fecha a notificação, rejeita URL externa e foca+navega cliente existente ou chama `openWindow` para `/notes/<id>`.
- [ ] Root liga manifest/apple icon/theme-color e registra `/sw.js` no client; SW não contém listener `fetch`, cache ou conteúdo autenticado.

**Verification:**

- [ ] `node --check apps/web/public/sw.js` e inspeção controlada no Application panel cobre payload válido/inválido e os dois caminhos do click; T15 automatiza o cenário.
- [ ] `npm run build -w @septo/web`; Application panel mostra scope `/` e manifest sem erro, sem Cache Storage criado pelo septo.
- [ ] Definition of Done global.

**Dependencies:** T13

**Files likely touched:**

- `apps/web/public/sw.js`
- `apps/web/src/routes/__root.tsx`
- `apps/web/src/features/reminders/push-client.ts`

**Estimated scope:** M (3 arquivos)

---

### T15: Integração, e2e e checklist de smoke Web Push real

**Descrição:** Fechar o comportamento automatizável no Playwright com browser APIs controladas e registrar uma checklist separada para entrega real com app fechado. O e2e não fala com FCM/APNs/Mozilla; o smoke usa VAPID real e anota plataforma/resultado.

**Acceptance criteria:**

- [ ] E2E prova: nenhum prompt no load, clique ativa e envia DTO, reload reconcilia, denied/unsupported aparecem, desativação remove a assinatura e manifest/SW/assets respondem.
- [ ] E2E simula `notificationclick` e confirma foco/navegação para a nota sem aceitar URL externa; suítes existentes continuam verdes.
- [ ] `smoke.md` cobre Chromium desktop, Chrome Android, Safari macOS e iOS/iPadOS instalado, registrando data, ambiente, recebimento com app fechado, latência e click; indisponibilidade é marcada, nunca fingida como aprovada.

**Verification:**

- [ ] `npm run test:e2e -w @septo/web -- reminders.spec.ts` três vezes sem flake.
- [ ] `npm run test:e2e` completo.
- [ ] Definition of Done global, mais smoke nas plataformas disponíveis.

**Dependencies:** T8, T10, T12, T14

**Files likely touched:**

- `apps/web/e2e/reminders.spec.ts`
- `tasks/reminders/smoke.md`

**Estimated scope:** M (2 arquivos)

---

### T16: Cobertura e documentação operacional

**Descrição:** Fechar lacunas de cobertura sem desabilitar testes e atualizar a documentação usada por operadores e agentes. Esta tarefa não muda status de módulo: primeiro registra fielmente como configurar, executar, diagnosticar e testar.

**Acceptance criteria:**

- [ ] Coverage de `reminders/{domain,application}` ≥ 90%; lacunas são cobertas por comportamento, sem testes que só perseguem linha.
- [ ] README documenta geração/configuração VAPID, ativação, PWA e limites best-effort.
- [ ] CLAUDE.md registra scheduler, segredos, fronteira `ReminderSource`, SW sem cache, armadilhas de teste e smoke real.

**Verification:**

- [ ] `npm run coverage -w @septo/api` e `npm run coverage -w @septo/web`.
- [ ] `npm run lint && npm run check-types && npm run build && npm run test && npm run test:e2e`.
- [ ] `git diff --check` e segunda geração do OpenAPI sem diff.

**Dependencies:** T15

**Files likely touched:**

- `README.md`
- `CLAUDE.md`
- Specs/testes pontuais de `apps/api/src/modules/reminders/` ou `apps/web/src/features/reminders/` apenas se a cobertura revelar lacuna real

**Estimated scope:** M (2–5 arquivos)

---

### T17: Auditoria dos critérios e fechamento do módulo

**Descrição:** Cruzar a implementação e o smoke com cada critério da spec. Atualizar somente o estado documental depois que as evidências existirem; se uma plataforma necessária não estiver disponível, registrar a limitação e pedir decisão antes de declarar o módulo implementado.

**Acceptance criteria:**

- [ ] Cada um dos 14 Success Criteria aponta para teste automatizado ou linha preenchida de `smoke.md`; falha ou lacuna não é tratada como sucesso.
- [ ] SPEC-reminders, extensão de SPEC-notes, CAPABILITY-MAP, plan e todo refletem decisões e comportamento reais, sem dívida silenciosa.
- [ ] Status muda para implementado somente depois da suíte final verde e da revisão humana; caso contrário permanece em progresso com o bloqueio explícito.

**Verification:**

- [ ] `git diff --check` e links locais dos documentos resolvem.
- [ ] Segunda geração do OpenAPI não produz diff.
- [ ] Revisão manual da matriz Spec → teste/smoke → resultado.

**Dependencies:** T16

**Files likely touched:**

- `specs/SPEC-reminders.md`
- `specs/SPEC-notes.md`
- `CAPABILITY-MAP.md`
- `tasks/reminders/plan.md`
- `tasks/reminders/todo.md`

**Estimated scope:** M (5 arquivos)

---

## Checkpoint final

- [ ] Todos os 14 Success Criteria da spec verificados.
- [ ] `lint`, `check-types`, `build`, `test` e `test:e2e` verdes.
- [ ] `openapi.json` commitado e idêntico a uma regeneração limpa.
- [ ] Smoke real aprovado nas plataformas disponíveis; lacunas de hardware/OS explícitas.
- [ ] README, CLAUDE.md, specs, CAPABILITY-MAP, plano e tarefas atualizados.
- [ ] Revisão final humana.
