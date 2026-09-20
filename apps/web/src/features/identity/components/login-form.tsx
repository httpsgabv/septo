import { Button } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { useAuthLogin } from '../../../shared/api/generated/endpoints/auth/auth';
import { getMeGetQueryKey } from '../../../shared/api/generated/endpoints/me/me';
import type { ErrorResponse } from '../../../shared/api/generated/models';
import { AuthLoginBody } from '../../../shared/api/generated/zod/auth/auth.zod';
import { parseRedirect } from '../domain/redirect';
import { describeWait } from '../domain/retry-after';

export function LoginForm({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const login = useAuthLogin({
    mutation: {
      onSuccess: (me) => {
        queryClient.setQueryData(getMeGetQueryKey(), me);
        router.history.push(parseRedirect(redirect));
      },
      onError: (failure) => setError(messageFor(failure)),
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = AuthLoginBody.safeParse({
      username: form.get('username'),
      password: form.get('password'),
    });
    if (!parsed.success) return setError('Informe usuário e senha.');
    setError(undefined);
    login.mutate({ data: parsed.data });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          Usuário
        </label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </div>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

function messageFor(failure: AxiosError<ErrorResponse>): string {
  switch (failure.response?.status) {
    // One message for both causes, exactly like the API: it must not reveal which one failed.
    case 401:
      return 'Usuário ou senha inválidos';
    case 429:
      return `Muitas tentativas. Tente de novo em ${describeWait(failure.response.headers['retry-after'])}.`;
    default:
      return 'Não foi possível entrar. Tente de novo em instantes.';
  }
}
