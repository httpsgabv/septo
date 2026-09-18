import { createFileRoute } from '@tanstack/react-router';
import { NotebookPenIcon } from 'lucide-react';
import { EmptyState, Page } from '../shared/layout/page';

export const Route = createFileRoute('/notes')({
  head: () => ({ meta: [{ title: 'Notas · septo' }] }),
  component: NotesPage,
});

function NotesPage() {
  return (
    <Page title="Notas" description="Ideias, anotações e lembretes num lugar só.">
      <EmptyState icon={NotebookPenIcon} title="Nenhuma nota por aqui">
        Criar e buscar notas chega no próximo módulo. Até lá, esta é a casa delas.
      </EmptyState>
    </Page>
  );
}
