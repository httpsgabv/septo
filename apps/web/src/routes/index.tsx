import { createFileRoute } from '@tanstack/react-router';
import {
  getCheckHealthQueryOptions,
  useCheckHealth,
} from '../shared/api/generated/endpoints/health/health';

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getCheckHealthQueryOptions()),
  component: Home,
});

function Home() {
  const { data } = useCheckHealth();
  return (
    <main>
      <h1>septo</h1>
      <p data-testid="api-status">API: {data?.status ?? 'indisponível'}</p>
    </main>
  );
}
