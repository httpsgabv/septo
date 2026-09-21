import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { ImageTool } from '../../../features/dev-tools/components/image-tool';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';

export const Route = createFileRoute('/_app/dev-tools/image')({
  head: () => ({ meta: [{ title: 'Imagens · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/image">
      {/* Canvas and createImageBitmap only exist in the browser; the tool has nothing to render on the server. */}
      <ClientOnly>
        <ImageTool />
      </ClientOnly>
    </ToolPage>
  ),
});
