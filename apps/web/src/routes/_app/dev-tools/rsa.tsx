import { createFileRoute } from '@tanstack/react-router';
import { RsaTool } from '../../../features/dev-tools/components/rsa-tool';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';

export const Route = createFileRoute('/_app/dev-tools/rsa')({
  head: () => ({ meta: [{ title: 'Chaves RSA · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/rsa">
      <RsaTool />
    </ToolPage>
  ),
});
