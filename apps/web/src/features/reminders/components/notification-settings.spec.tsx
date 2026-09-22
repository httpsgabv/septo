import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PushClientState } from '../push-client';
import { NotificationSettings, NotificationSettingsView } from './notification-settings';

const noop = vi.fn();

function render(state: PushClientState | null, options: { busy?: boolean; error?: boolean } = {}) {
  return renderToStaticMarkup(
    <NotificationSettingsView
      state={state}
      busy={options.busy ?? false}
      feedback={
        options.error
          ? { kind: 'error', text: 'Não foi possível verificar. Tente de novo.' }
          : undefined
      }
      onActivate={noop}
      onDeactivate={noop}
      onRetry={noop}
    />,
  );
}

describe('NotificationSettingsView', () => {
  it('oferece ativação quando a permissão ainda não foi pedida', () => {
    const html = render({ kind: 'default' });

    expect(html).toContain('Ativar notificações');
    expect(html).toContain('A permissão só será pedida depois do seu clique.');
  });

  it('oferece desativação somente para a assinatura ativa', () => {
    const html = render({
      kind: 'enabled',
      subscriptionId: 'subscription-id',
      subscription: { toJSON: () => ({}), unsubscribe: async () => true },
    });

    expect(html).toContain('Ativas neste navegador.');
    expect(html).toContain('Desativar');
    expect(html).not.toContain('Ativar notificações');
  });

  it('explica como liberar uma permissão bloqueada sem oferecer ação impossível', () => {
    const html = render({ kind: 'denied' });

    expect(html).toContain('bloqueadas');
    expect(html).toContain('configurações do navegador ou do sistema');
    expect(html).not.toContain('<button');
  });

  it('mostra ajuda de instalação quando Web Push não é suportado', () => {
    const html = render({ kind: 'unsupported' });

    expect(html).toContain('Indisponível neste navegador');
    expect(html).toContain('Adicionar à Tela de Início');
    expect(html).not.toContain('<button');
  });

  it('desabilita a ação enquanto a mutação está em andamento', () => {
    const html = render({ kind: 'default' }, { busy: true });

    expect(html).toContain('Ativando…');
    expect(html).toContain('disabled');
  });

  it('oferece retry e anuncia erros', () => {
    const html = render(null, { error: true });

    expect(html).toContain('role="alert"');
    expect(html).toContain('Tentar de novo');
  });

  it('é segura para renderização no servidor', () => {
    expect(() => renderToStaticMarkup(<NotificationSettings />)).not.toThrow();
  });
});
