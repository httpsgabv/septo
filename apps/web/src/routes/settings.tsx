import { Button } from '@septo/ui/components/button';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AccentPicker } from '../features/settings/components/accent-picker';
import { ThemePicker } from '../features/settings/components/theme-picker';
import { DEFAULT_PREFERENCES } from '../features/settings/domain/preferences';
import { usePreferences } from '../features/settings/use-preferences';
import { Page } from '../shared/layout/page';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Configurações · septo' }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [preferences, update] = usePreferences();

  return (
    <Page title="Configurações" description="Aparência do septo neste navegador.">
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

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-0.5 text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </section>
  );
}
