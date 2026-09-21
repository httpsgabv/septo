import { Skeleton } from '@septo/ui/components/skeleton';
import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { ToolPage } from '../../../features/dev-tools/components/tool-page';

// The three parsers are their own chunk: the index and the other tools never download them.
const DataTool = lazy(() =>
  import('../../../features/dev-tools/components/data-tool').then((m) => ({ default: m.DataTool })),
);

export const Route = createFileRoute('/_app/dev-tools/data')({
  head: () => ({ meta: [{ title: 'Dados · Dev Tools · septo' }] }),
  component: () => (
    <ToolPage to="/dev-tools/data">
      <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <DataTool />
        </Suspense>
      </ClientOnly>
    </ToolPage>
  ),
});
