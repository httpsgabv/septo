import { createFileRoute } from '@tanstack/react-router';
import { HammerIcon } from 'lucide-react';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';
import { EmptyState } from '../../../shared/layout/page';

export const Route = createFileRoute('/_app/dev-tools/json')({
  head: () => ({ meta: [{ title: 'JSON · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/json">
      <EmptyState icon={HammerIcon} title="Em construção">
        Esta ferramenta chega numa próxima tarefa.
      </EmptyState>
    </ToolPage>
  ),
});
