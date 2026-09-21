import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Workspace } from '../../../features/dev-tools/components/workspace';

// The three parsers are their own chunk: the index and the other tools never download them.
const DataTool = lazy(() =>
  import('../../../features/dev-tools/components/data-tool').then((m) => ({ default: m.DataTool })),
);

// The empty frame keeps the heading in the server HTML and the layout still while the chunk loads.
const loading = <Workspace to="/dev-tools/data" />;

export const Route = createFileRoute('/_app/dev-tools/data')({
  head: () => ({ meta: [{ title: 'Dados · Dev Tools · septo' }] }),
  component: () => (
    <ClientOnly fallback={loading}>
      <Suspense fallback={loading}>
        <DataTool />
      </Suspense>
    </ClientOnly>
  ),
});
