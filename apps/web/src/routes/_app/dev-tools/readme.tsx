import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Workspace } from '../../../features/dev-tools/components/workspace';

// Tiptap is its own chunk, shared with the notes editor: no other route downloads it.
const ReadmeTool = lazy(() =>
  import('../../../features/dev-tools/components/readme-tool').then((m) => ({
    default: m.ReadmeTool,
  })),
);

// The empty frame keeps the heading in the server HTML and the layout still while the chunk loads.
const loading = <Workspace to="/dev-tools/readme" />;

export const Route = createFileRoute('/_app/dev-tools/readme')({
  head: () => ({ meta: [{ title: 'README · Dev Tools · septo' }] }),
  component: () => (
    <ClientOnly fallback={loading}>
      <Suspense fallback={loading}>
        <ReadmeTool />
      </Suspense>
    </ClientOnly>
  ),
});
