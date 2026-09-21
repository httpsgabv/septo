import { createFileRoute } from '@tanstack/react-router';
import { HammerIcon } from 'lucide-react';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';
import { EmptyState } from '../../../shared/layout/page';

export const Route = createFileRoute('/_app/dev-tools/image')({
  head: () => ({ meta: [{ title: 'Imagens · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/image">
      <EmptyState icon={HammerIcon} title="Em construção">
        Esta ferramenta chega numa próxima tarefa.
      </EmptyState>
    </ToolPage>
  ),
});
