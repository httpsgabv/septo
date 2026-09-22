import { Button } from '@septo/ui/components/button';
import { createFileRoute } from '@tanstack/react-router';
import { AccountSettings } from '../../features/identity/components/account-settings';
import { NotificationSettings } from '../../features/reminders/components/notification-settings';
import { AccentPicker } from '../../features/settings/components/accent-picker';
import { ThemePicker } from '../../features/settings/components/theme-picker';
import { DEFAULT_PREFERENCES } from '../../features/settings/domain/preferences';
import { usePreferences } from '../../features/settings/use-preferences';
import { Page } from '../../shared/layout/page';
import { SettingRow } from '../../shared/layout/setting-row';

export const Route = createFileRoute('/_app/settings')({
  head: () => ({ meta: [{ title: 'Configurações · septo' }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [preferences, update] = usePreferences();

  return (
    <Page title="Configurações" description="Sua conta e a aparência do septo.">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Conta</h2>
      <AccountSettings />

      <h2 className="mt-10 mb-3 text-sm font-medium text-muted-foreground">Notificações</h2>
      <NotificationSettings />

      <h2 className="mt-10 mb-3 text-sm font-medium text-muted-foreground">Aparência</h2>
      <div className="divide-y rounded-xl border">
        <SettingRow title="Tema" description="Siga o sistema ou fixe claro ou escuro.">
          <ThemePicker value={preferences?.theme} onChange={(theme) => update({ theme })} />
        </SettingRow>
        <SettingRow
          title="Cor de destaque"
          description="Usada em ações principais, item ativo e foco. O contraste se ajusta sozinho."
        >
          <AccentPicker value={preferences?.accent} onChange={(accent) => update({ accent })} />
        </SettingRow>
        <SettingRow
          title="Restaurar padrão"
          description="Volta para o tema do sistema e o roxo septo."
        >
          <Button
            variant="outline"
            size="sm"
            disabled={
              !preferences ||
              (preferences.theme === DEFAULT_PREFERENCES.theme &&
                preferences.accent === DEFAULT_PREFERENCES.accent)
            }
            onClick={() => update(DEFAULT_PREFERENCES)}
          >
            Restaurar
          </Button>
        </SettingRow>
      </div>
    </Page>
  );
}
