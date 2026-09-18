import { createFileRoute } from '@tanstack/react-router';
import { PaletteIcon } from 'lucide-react';
import { EmptyState, Page } from '../shared/layout/page';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Configurações · septo' }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Page title="Configurações" description="Tema e cor de destaque.">
      <EmptyState icon={PaletteIcon} title="Personalização em breve">
        Escolha entre tema claro e escuro e a cor de destaque do app.
      </EmptyState>
    </Page>
  );
}
