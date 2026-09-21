import { Skeleton } from '@septo/ui/components/skeleton';
import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';

// Tiptap is its own chunk, shared with the notes editor: no other route downloads it.
const ReadmeTool = lazy(() =>
  import('../../../features/dev-tools/components/readme-tool').then((m) => ({
    default: m.ReadmeTool,
  })),
);

export const Route = createFileRoute('/_app/dev-tools/readme')({
  head: () => ({ meta: [{ title: 'README · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/readme">
      <ClientOnly fallback={<Skeleton className="h-[28rem] w-full" />}>
        <Suspense fallback={<Skeleton className="h-[28rem] w-full" />}>
          <ReadmeTool />
        </Suspense>
      </ClientOnly>
    </ToolPage>
  ),
});
