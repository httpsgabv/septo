import { Button } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { getMeGetQueryKey, useMeUpdate } from '../../../shared/api/generated/endpoints/me/me';
import { MeUpdateBody } from '../../../shared/api/generated/zod/me/me.zod';

const INVALID = 'Use de 1 a 50 caracteres, sem espaços no começo ou no fim.';

export function DisplayNameForm({ current }: { current: string }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; text: string }>();
  const update = useMeUpdate({
    mutation: {
      onSuccess: (me) => {
        queryClient.setQueryData(getMeGetQueryKey(), me);
        setStatus({ kind: 'saved', text: 'Salvo.' });
      },
      onError: () => setStatus({ kind: 'error', text: 'Não foi possível salvar. Tente de novo.' }),
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = MeUpdateBody.safeParse({
      displayName: new FormData(event.currentTarget).get('displayName'),
    });
    if (!parsed.success) return setStatus({ kind: 'error', text: INVALID });
    setStatus(undefined);
    update.mutate({ data: parsed.data });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5 sm:items-end">
      <div className="flex gap-2">
        <Input
          // Remounted on save so the field shows what the server stored.
          key={current}
          name="displayName"
          defaultValue={current}
          aria-label="Nome de exibição"
          aria-invalid={status?.kind === 'error' ? true : undefined}
          autoComplete="nickname"
          className="w-48"
        />
        <Button type="submit" variant="outline" size="sm" disabled={update.isPending}>
          Salvar
        </Button>
      </div>
      <p
        role={status?.kind === 'error' ? 'alert' : 'status'}
        className={
          status?.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
        }
      >
        {status?.text}
      </p>
    </form>
  );
}
