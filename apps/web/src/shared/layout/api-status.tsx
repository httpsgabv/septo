import { SidebarMenuButton, SidebarMenuItem } from '@septo/ui/components/sidebar';
import { cn } from '@septo/ui/lib/utils';
import { isAxiosError } from 'axios';
import { useHealthCheck } from '../api/generated/endpoints/health/health';
import type { HealthResponse } from '../api/generated/models';

const STATES = {
  checking: { label: 'Verificando a API…', dot: 'bg-muted-foreground' },
  online: { label: 'API online', dot: 'bg-emerald-500' },
  degraded: { label: 'Banco de dados fora do ar', dot: 'bg-amber-500' },
  offline: { label: 'API fora do ar', dot: 'bg-destructive' },
} as const;

export function ApiStatus() {
  const { data, error, isPending } = useHealthCheck({ query: { refetchInterval: 60_000 } });
  // A 503 still carries the report in the body.
  const report = data ?? (isAxiosError<HealthResponse>(error) ? error.response?.data : undefined);
  const state = isPending
    ? STATES.checking
    : report?.status === 'ok'
      ? STATES.online
      : report
        ? STATES.degraded
        : STATES.offline;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<div role="status" />}
        tooltip={state.label}
        className="text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
      >
        <span className="flex size-4 items-center justify-center">
          <span className={cn('size-2 rounded-full', state.dot)} />
        </span>
        <span data-testid="api-status">{state.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
