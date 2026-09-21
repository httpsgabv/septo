import { createFileRoute } from '@tanstack/react-router';
import { JsonTool } from '../../../features/dev-tools/components/json-tool';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';

export const Route = createFileRoute('/_app/dev-tools/json')({
  head: () => ({ meta: [{ title: 'JSON · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/json">
      <JsonTool />
    </ToolPage>
  ),
});
