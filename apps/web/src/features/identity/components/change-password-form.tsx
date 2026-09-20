import { Button } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import type { AxiosError } from 'axios';
import { type FormEvent, useRef, useState } from 'react';
import { useMeChangePassword } from '../../../shared/api/generated/endpoints/me/me';
import type { ErrorResponse } from '../../../shared/api/generated/models';
import { MeChangePasswordBody } from '../../../shared/api/generated/zod/me/me.zod';

type Status = { kind: 'saved' | 'error'; text: string };

export function ChangePasswordForm() {
  const form = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>();
  const change = useMeChangePassword({
    mutation: {
      onSuccess: () => {
        form.current?.reset();
        setStatus({
          kind: 'saved',
          text: 'Senha alterada. Os outros dispositivos foram desconectados.',
        });
      },
      onError: (failure) => setStatus({ kind: 'error', text: messageFor(failure) }),
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = MeChangePasswordBody.safeParse({
      currentPassword: data.get('currentPassword'),
      newPassword: data.get('newPassword'),
    });
    if (!parsed.success) {
      const short = data.get('currentPassword') && !data.get('newPassword');
      return setStatus({
        kind: 'error',
        text: short
          ? 'Informe a nova senha.'
          : 'Informe a senha atual e uma nova de 12 a 128 caracteres.',
      });
    }
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      return setStatus({ kind: 'error', text: 'A confirmação é diferente da nova senha.' });
    }
    setStatus(undefined);
    change.mutate({ data: parsed.data });
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="flex max-w-sm flex-col gap-3">
      <PasswordField id="currentPassword" label="Senha atual" autoComplete="current-password" />
      <PasswordField
        id="newPassword"
        label="Nova senha (12 a 128 caracteres)"
        autoComplete="new-password"
      />
      <PasswordField id="confirmPassword" label="Repita a nova senha" autoComplete="new-password" />
      <p
        role={status?.kind === 'error' ? 'alert' : 'status'}
        className={
          status?.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
        }
      >
        {status?.text}
      </p>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={change.isPending}
      >
        Trocar senha
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
}: {
  id: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} name={id} type="password" autoComplete={autoComplete} />
    </div>
  );
}

function messageFor(failure: AxiosError<ErrorResponse>): string {
  switch (failure.response?.data?.code) {
    case 'INVALID_CURRENT_PASSWORD':
      return 'A senha atual está incorreta.';
    case 'VALIDATION_ERROR':
    case 'WEAK_PASSWORD':
      return 'A nova senha deve ter de 12 a 128 caracteres.';
    default:
      return 'Não foi possível trocar a senha. Tente de novo.';
  }
}
