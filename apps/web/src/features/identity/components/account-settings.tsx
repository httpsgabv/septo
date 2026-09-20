import { useSyncExternalStore } from 'react';
import { useMeGet } from '../../../shared/api/generated/endpoints/me/me';
import { SettingRow } from '../../../shared/layout/setting-row';
import { formatLastLogin } from '../domain/last-login';
import { ChangePasswordForm } from './change-password-form';
import { DisplayNameForm } from './display-name-form';
import { RevokeSessions } from './revoke-sessions';

const noop = () => () => {};

export function AccountSettings() {
  const { data: me } = useMeGet();
  // The server has no idea of the viewer's time zone: format after hydration, not during it.
  const lastLogin = useSyncExternalStore(
    noop,
    () => formatLastLogin(me?.lastLoginAt ?? null),
    () => '',
  );
  if (!me) return null;

  return (
    <div className="divide-y rounded-xl border">
      <SettingRow title="Usuário" description="Como você entra. Só muda pelo terminal do servidor.">
        <p className="font-mono text-sm">{me.username}</p>
      </SettingRow>
      <SettingRow title="Nome de exibição" description="Aparece no menu do usuário.">
        <DisplayNameForm current={me.displayName} />
      </SettingRow>
      <SettingRow title="Último login" description="Data e endereço IP do login mais recente.">
        <p className="text-right text-sm">
          <time dateTime={me.lastLoginAt ?? undefined}>{lastLogin || ' '}</time>
          {me.lastLoginIp && <span className="block text-muted-foreground">{me.lastLoginIp}</span>}
        </p>
      </SettingRow>
      <section className="px-5 py-4">
        <h2 className="font-medium">Trocar senha</h2>
        <p className="mt-0.5 mb-4 text-muted-foreground">
          Os outros dispositivos são desconectados; este continua entrado.
        </p>
        <ChangePasswordForm />
      </section>
      <SettingRow
        title="Sair de todos os dispositivos"
        description="Encerra todas as sessões, inclusive esta."
      >
        <RevokeSessions />
      </SettingRow>
    </div>
  );
}
