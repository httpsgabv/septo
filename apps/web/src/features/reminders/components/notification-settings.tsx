import { Button } from '@septo/ui/components/button';
import { useEffect, useRef, useState } from 'react';
import { SettingRow } from '../../../shared/layout/setting-row';
import {
  createBrowserPushClient,
  type createPushClient,
  type PushClientState,
} from '../push-client';
import { PwaInstallHelp } from './pwa-install-help';

type PushClient = ReturnType<typeof createPushClient>;
type Feedback = { kind: 'error' | 'success'; text: string };

export function NotificationSettings() {
  const client = useRef<PushClient | null>(null);
  const mounted = useRef(true);
  const [state, setState] = useState<PushClientState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  useEffect(() => {
    mounted.current = true;
    const current = createBrowserPushClient();
    client.current = current;
    void current
      .reconcile()
      .then((next) => {
        if (mounted.current) setState(next);
      })
      .catch(() => {
        if (mounted.current) {
          setFeedback({ kind: 'error', text: 'Não foi possível verificar. Tente de novo.' });
        }
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  async function reconcile() {
    if (!client.current) return;
    setBusy(true);
    setFeedback(undefined);
    try {
      setState(await client.current.reconcile());
    } catch {
      setFeedback({ kind: 'error', text: 'Não foi possível verificar. Tente de novo.' });
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!client.current) return;
    setBusy(true);
    setFeedback(undefined);
    try {
      const next = await client.current.activate();
      setState(next);
      if (next.kind === 'enabled') {
        setFeedback({ kind: 'success', text: 'Notificações ativadas neste navegador.' });
      }
    } catch {
      setFeedback({ kind: 'error', text: 'Não foi possível ativar. Tente de novo.' });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!client.current || state?.kind !== 'enabled') return;
    setBusy(true);
    setFeedback(undefined);
    try {
      setState(await client.current.deactivate(state));
      setFeedback({ kind: 'success', text: 'Notificações desativadas neste navegador.' });
    } catch {
      setFeedback({
        kind: 'error',
        text: 'Não foi possível desativar. A assinatura deste navegador foi preservada.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <NotificationSettingsView
      state={state}
      busy={busy}
      feedback={feedback}
      onActivate={() => void activate()}
      onDeactivate={() => void deactivate()}
      onRetry={() => void reconcile()}
    />
  );
}

export function NotificationSettingsView({
  state,
  busy,
  feedback,
  onActivate,
  onDeactivate,
  onRetry,
}: {
  state: PushClientState | null;
  busy: boolean;
  feedback?: Feedback;
  onActivate: () => void;
  onDeactivate: () => void;
  onRetry: () => void;
}) {
  const description = describe(state);

  return (
    <div className="divide-y rounded-xl border">
      <SettingRow title="Notificações" description={description}>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <Action
            state={state}
            busy={busy}
            failedToLoad={state === null && feedback?.kind === 'error'}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
            onRetry={onRetry}
          />
          {state?.kind === 'default' && !feedback && (
            <p className="max-w-64 text-right text-sm text-muted-foreground">
              A permissão só será pedida depois do seu clique.
            </p>
          )}
          {feedback && (
            <p
              role={feedback.kind === 'error' ? 'alert' : 'status'}
              className={
                feedback.kind === 'error'
                  ? 'max-w-72 text-right text-sm text-destructive'
                  : 'max-w-72 text-right text-sm text-muted-foreground'
              }
            >
              {feedback.text}
            </p>
          )}
        </div>
      </SettingRow>
      {state?.kind === 'unsupported' && <PwaInstallHelp />}
    </div>
  );
}

function Action({
  state,
  busy,
  failedToLoad,
  onActivate,
  onDeactivate,
  onRetry,
}: {
  state: PushClientState | null;
  busy: boolean;
  failedToLoad: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onRetry: () => void;
}) {
  if (state === null) {
    if (failedToLoad) {
      return (
        <Button variant="outline" size="sm" disabled={busy} onClick={onRetry}>
          {busy ? 'Verificando…' : 'Tentar de novo'}
        </Button>
      );
    }
    return (
      <span role="status" className="text-sm text-muted-foreground">
        Verificando…
      </span>
    );
  }
  if (state.kind === 'default') {
    return (
      <Button size="sm" disabled={busy} onClick={onActivate}>
        {busy ? 'Ativando…' : 'Ativar notificações'}
      </Button>
    );
  }
  if (state.kind === 'enabled') {
    return (
      <Button variant="outline" size="sm" disabled={busy} onClick={onDeactivate}>
        {busy ? 'Desativando…' : 'Desativar'}
      </Button>
    );
  }
  return <span className="text-sm text-muted-foreground">Sem ação disponível</span>;
}

function describe(state: PushClientState | null) {
  if (state === null) return 'Verificando o estado deste navegador.';
  if (state.kind === 'enabled') return 'Ativas neste navegador.';
  if (state.kind === 'denied') {
    return 'As notificações estão bloqueadas. Libere-as nas configurações do navegador ou do sistema.';
  }
  if (state.kind === 'unsupported') return 'Indisponível neste navegador.';
  return 'Receba um aviso quando chegar a hora de uma nota.';
}
