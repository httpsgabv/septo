# Smoke real — reminders / Web Push

Este roteiro valida o que o ambiente automatizado não pode garantir: serviço de push externo,
permissão do sistema operacional, entrega com o app fechado e abertura da nota pela notificação.
Nunca registre endpoint, `p256dh`, `auth`, chave VAPID privada nem conteúdo sensível da nota.

## Pré-condições

- HTTPS válido no ambiente testado.
- API e web na mesma origem pública, com `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY` e
  `VAPID_PRIVATE_KEY` do mesmo par.
- Migrações aplicadas e usuário autenticado.
- Uma nota de teste sem conteúdo sensível, com lembrete de 2 a 3 minutos no futuro.
- Em iOS/iPadOS, o septo instalado pela opção **Adicionar à Tela de Início** e aberto pelo ícone.

## Passos por plataforma

1. Em Configurações, confirme que nenhum prompt aparece no carregamento.
2. Clique em **Ativar notificações**, aceite a permissão e recarregue a página.
3. Confirme que o estado continua **Ativas neste navegador** sem novo prompt.
4. Feche o app/navegador e aguarde o horário da nota.
5. Registre recebimento, latência aproximada e se uma única notificação apareceu.
6. Toque/clique na notificação e confirme que a nota correta abre.
7. Volte a Configurações, desative e confirme que o estado volta a disponível.

## Evidências

| Plataforma | Data/ambiente | App fechado | Latência | Click abriu a nota | Resultado/observação |
|---|---|---:|---:|---:|---|
| Chromium desktop | não executado | — | — | — | Requer ambiente HTTPS e permissão do SO |
| Chrome Android | não executado | — | — | — | Requer dispositivo Android |
| Safari macOS | não executado | — | — | — | Requer macOS com permissão de notificações |
| iOS/iPadOS Home Screen | não executado | — | — | — | Requer dispositivo iOS/iPadOS e PWA instalada |

## Diagnóstico seguro

- Se não houver entrega, verifique apenas os contadores estruturados do tick e os ids internos da
  entrega; não copie credenciais da assinatura para logs ou para este documento.
- Confirme que o scheduler iniciou, que a nota está dentro da janela de 24 h e que
  `updatedAt < remindAt`.
- `404`/`410` do push service deve remover a assinatura expirada; outros `4xx` falham sem retry;
  rede, `408`, `429` e `5xx` tentam novamente conforme a política.
- Marque plataforma indisponível como **não executado**. Não converta ausência de dispositivo em
  aprovação.
