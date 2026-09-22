# Implementation Plan: reminders

> Spec: [SPEC-reminders](../../specs/SPEC-reminders.md) · Tarefas: [todo.md](todo.md) · Status: **aprovado em 2026-09-22**

## Overview

Web Push para os `remindAt` das notas, com assinaturas por navegador, scheduler de 1 minuto na API, ledger idempotente de entregas, retries, service worker e instalação PWA. O plano valida cedo os dois riscos externos — integração ESM/tipos do `web-push` e a fronteira somente leitura fornecida por `notes` — e depois constrói três fatias verificáveis: persistência e despacho na API, assinatura pela UI e recebimento/click pelo service worker.

O projeto define tarefas por módulo em `tasks/<id>/`; por isso o task list target desta iniciativa é [tasks/reminders/todo.md](todo.md), não o fallback global `tasks/todo.md`.

## Grafo de dependências

```text
T1 dependência + VAPID/env ─▶ T2 adapter web-push ⚠️ risco externo

T3 notes.ReminderSource ⚠️ fronteira ─────────────────────────────┐
                                                                  │
T4 migration ─┬─▶ T5 assinatura persistida ─┬─▶ T9 casos de uso  │
              │                              │       de assinatura ─▶ T10 HTTP + OpenAPI
              └─▶ T6 entrega persistida ─────┤                              │
                                             └─▶ T7 despacho ◀──── T2, T3 ─┤
                                                     │                      │
                                                     └─▶ T8 scheduler       │
                                                                            ▼
                                                               T11 client de assinatura
                                                                            │
                                                                            └─▶ T12 UI Configurações

T13 manifest + ícones ─▶ T14 service worker + registro

T8 + T10 + T12 + T14 ─▶ T15 integração/e2e/smoke ─▶ T16 cobertura e docs ─▶ T17 fechamento
```

## Architecture Decisions

- **Riscos primeiro.** T1–T3 provam configuração VAPID, compatibilidade do pacote CommonJS com a API ESM/SWC e a query temporal de `ReminderSource` antes de existir scheduler ou UI.
- **Contrato no provedor.** T3 implementa `ReminderSource` dentro de `notes` e exporta só a classe/token. Nenhum arquivo de `reminders` consulta o model Prisma `Note` diretamente.
- **Duas entidades persistidas, duas tarefas.** T5 fecha o ciclo da assinatura (domínio → porta → Prisma); T6 faz o mesmo para a entrega. Cada uma fica testável sem o scheduler.
- **O caso de uso é o scheduler de verdade.** T7 contém materialização, confirmação, envio, retry e estados. T8 só agenda `execute()` no boot/a cada 60 s e impede sobreposição local.
- **Sender fora da transação.** T7 persiste/materializa, libera a transação, envia e só então registra o resultado. A semântica continua at-least-once, como a spec promete.
- **Contrato HTTP depois da regra.** T9 cria os casos de uso de config/upsert/delete. T10 adiciona a borda zod/OpenAPI, o teste de integração e o client Orval numa única fatia.
- **Web sem API manual.** T11 consome somente os hooks/funções gerados pelo Orval. Browser globals ficam atrás de feature detection e nunca executam no SSR.
- **PWA sem cache.** T13 entrega identidade instalável; T14 entrega `/sw.js`, registro, `push` e `notificationclick`. Não há handler `fetch`, Workbox nem promessa de offline.
- **Teste determinístico.** Unit/integration usam `PushSender` fake. Playwright mocka as APIs de push para o fluxo da tela. Entrega real em background fica numa checklist de smoke manual por depender do SO e de serviços externos.
- **Um commit por tarefa.** Só T10 muda contrato HTTP e roda `npm run codegen`; só T4 gera migration. Assim os diffs de contrato e banco ficam concentrados.

## Task List

### Fase 1: riscos e fronteiras

- [x] T1: Dependência `web-push` e configuração VAPID validada
- [x] T2: Porta `PushSender` e adapter `web-push` com classificação de resultados
- [x] T3: `ReminderSource` fornecido por `notes`

### Checkpoint A: integrações externas provadas

- [x] API ESM/SWC importa e testa `web-push@3.6.7` sem workaround global
- [x] Produção falha sem VAPID; dev/test/codegen sobem com o par dev-only
- [x] `ReminderSource` encontra somente candidatos elegíveis e continua privado ao módulo `notes`
- [x] `lint`, `check-types` e `test` passam
- [x] Revisão humana antes de criar o ledger e o scheduler

### Fase 2: persistência e despacho

- [x] T4: Models Prisma e migration de assinaturas/entregas
- [x] T5: Fatia de persistência de `PushSubscription`
- [x] T6: Fatia de persistência de `ReminderDelivery`
- [x] T7: Caso de uso de despacho, fan-out, idempotência e retries
- [x] T8: Scheduler de 60 s e wiring do módulo

### Checkpoint B: scheduler completo sem HTTP

- [x] Tick com relógio fixo cria uma entrega por assinatura elegível e não duplica no tick seguinte
- [x] Data criada no passado, nota obsoleta/arquivada/excluída e atraso > 24 h não enviam
- [x] Sucesso, retry, falha permanente e remoção `404`/`410` persistem os estados previstos
- [x] O sender fake confirma que nenhuma chamada de rede ocorre dentro da transação
- [x] `lint`, `check-types`, `test` e coverage do módulo passam

### Fase 3: contrato HTTP e assinatura no navegador

- [x] T9: Casos de uso de config, upsert e remoção da assinatura
- [x] T10: Controller, schemas, integração HTTP, OpenAPI e Orval
- [x] T11: Domínio/client web para suporte, ativação, reconciliação e desativação
- [x] T12: Configurações → Notificações e ajuda de instalação

### Checkpoint C: assinatura ponta a ponta

- [x] O prompt só nasce de clique; reload reconcilia sem pedir permissão de novo
- [x] Upsert devolve id estável e nenhum segredo aparece em resposta/log
- [x] Desativar remove somente a assinatura atual e preserva o browser se a API falhar
- [x] Estados incompatível, disponível, bloqueado e ativo aparecem em PT-BR
- [x] `openapi.json` está commitado e igual ao gerado; `lint`, `check-types` e `test` passam

### Fase 4: PWA e fechamento

- [x] T13: Manifest e conjunto de ícones PWA
- [x] T14: Service worker, registro client-only e click para a nota
- [ ] T15: Integração, e2e e checklist de smoke Web Push real
- [ ] T16: Cobertura e documentação operacional
- [ ] T17: Auditoria dos critérios e fechamento do módulo

### Checkpoint final

- [ ] Todos os 14 Success Criteria da spec verificados
- [ ] `lint`, `check-types`, `build`, `test` e `test:e2e` verdes
- [ ] Smoke real aprovado nas plataformas disponíveis e lacunas explicitadas
- [ ] `openapi.json`, `.env.example`, README, CLAUDE.md, specs e CAPABILITY-MAP atualizados
- [ ] Revisão final humana

## Paralelização

- **T1–T2 ‖ T3:** sender/configuração e fonte de notas não compartilham arquivos.
- **T5 ‖ T6:** depois da migration, assinatura e entrega têm domínio/portas/adapters separados. A integração no módulo fica para T8.
- **T9–T12 ‖ T13–T14:** depois do contrato HTTP, o fluxo de assinatura e a casca PWA são independentes até o e2e. `__root.tsx` pertence somente a T14 para evitar conflito.
- **Sequenciais:** T7 depende de T2/T3/T5/T6; T8 depende de T7; T10 depende de T9; T11 depende do codegen da T10; T15 depende de todos os fluxos.

Paralelizar significa sessões independentes sobre arquivos disjuntos; não muda os gates de revisão nem autoriza implementação simultânea sem coordenação.

## Verification Strategy

- **Por tarefa:** teste focado indicado no `todo.md`, depois `npm run lint`, `npm run check-types` e `npm run test` conforme o Definition of Done do projeto.
- **Contrato:** T10 executa `npm run codegen` e o teste que compara `openapi.json` ao documento gerado.
- **Banco:** T4–T10 rodam contra `septo_test`, migrado do zero pelo `globalSetup`.
- **Browser:** T11–T14 têm unitários sem DOM onde possível; T15 usa Playwright com APIs de Push/Notification controladas.
- **Rede real:** somente o smoke manual usa FCM/APNs/Mozilla e app fechado; seus resultados ficam registrados em `tasks/reminders/smoke.md`.

## Risks and Mitigations

| Risco | Impacto | Mitigação |
|---|---|---|
| `web-push` CommonJS/tipos não funcionam com ESM + SWC | Alto | T1/T2 primeiro; build e unit do adapter antes de model/scheduler |
| Scheduler envia lembrete antigo ou duplicado | Alto | Query `updatedAt < remindAt`, janela 24 h, confirmação antes do envio, índice único e testes de ticks repetidos em T7 |
| Retry segura transação enquanto espera rede | Alto | Repositório materializa/carrega; sender roda fora da transação; resultado é persistido depois |
| Processo cai depois do push e antes do `sent` | Médio | Semântica at-least-once explícita; `topic` e `tag` estáveis; teste não promete exatamente uma vez |
| Timer deixa testes/processo presos | Médio | Ciclo de vida Nest explícito, `clearInterval` no shutdown, timer `unref()` e scheduler substituível no teste |
| Browser globals quebram SSR | Alto | `push-client` só chamado em efeito/gesto; domínio puro testado em Node; build SSR em todo checkpoint web |
| iOS só expõe Web Push em Home Screen web app | Médio | Feature detection + orientação dedicada; smoke manual em contexto instalado |
| Service worker antigo ou payload inválido quebra notificação | Médio | Sem cache, `skipWaiting`/`clients.claim`, parser defensivo com fallbacks e e2e de click |
| Segredos/capability URL aparecem em log/snapshot | Alto | DTO de resposta mínimo, logger recebe ids/status/host; testes negativos sobre respostas e mensagens |
| CI de push real fica flaky | Alto | Sender fake e browser mocks no CI; smoke real separado e obrigatório para fechamento |

## Open Questions

Nenhuma. A spec aprovada fechou recuperação de 24 horas, fan-out para todos os dispositivos ativos, conteúdo limitado ao título, uma instância da API e PWA sem offline.
