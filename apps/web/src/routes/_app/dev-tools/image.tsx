import { createFileRoute } from '@tanstack/react-router';
import { ImageTool } from '../../../features/dev-tools/components/image-tool';

export const Route = createFileRoute('/_app/dev-tools/image')({
  head: () => ({ meta: [{ title: 'Imagens · Dev Tools · septo' }] }),
  // Canvas and createImageBitmap are only touched in effects and handlers: the frame renders on the server.
  component: ImageTool,
});
