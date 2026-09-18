import { createFileRoute } from '@tanstack/react-router';
import {
  getHealthCheckQueryOptions,
  useHealthCheck,
} from '../shared/api/generated/endpoints/health/health';

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getHealthCheckQueryOptions()),
  component: Home,
});

function Home() {
  const { data } = useHealthCheck();
  return (
    <main>
      <h1>septo</h1>
      <p data-testid="api-status">API: {data?.status ?? 'indisponível'}</p>
    </main>
  );
}
