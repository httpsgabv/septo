import { createFileRoute } from '@tanstack/react-router';
import { NotebookPenIcon } from 'lucide-react';
import { EmptyState } from '../../../shared/layout/page';

export const Route = createFileRoute('/_app/notes/')({
  component: NoNoteSelected,
});

function NoNoteSelected() {
  return (
    <div className="p-6 md:p-10">
      <EmptyState icon={NotebookPenIcon} title="Selecione ou crie uma nota">
        Escolha uma nota na lista ao lado, ou comece uma nova.
      </EmptyState>
    </div>
  );
}
