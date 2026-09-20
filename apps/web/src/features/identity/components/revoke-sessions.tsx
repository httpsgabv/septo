import { Button } from '@septo/ui/components/button';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useMeRevokeSessions } from '../../../shared/api/generated/endpoints/me/me';

/** Two clicks instead of a dialog: the first asks, the second does it. */
export function RevokeSessions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const revoke = useMeRevokeSessions({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        router.history.push('/login');
      },
    },
  });

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Sair de todos
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="destructive"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate()}
      >
        Sim, sair de todos
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </div>
  );
}
