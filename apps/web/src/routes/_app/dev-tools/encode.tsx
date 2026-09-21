import { createFileRoute } from '@tanstack/react-router';
import { EncodeTool } from '../../../features/dev-tools/components/encode-tool';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';

export const Route = createFileRoute('/_app/dev-tools/encode')({
  head: () => ({ meta: [{ title: 'Encodings · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/encode">
      <EncodeTool />
    </ToolPage>
  ),
});
