import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginForm } from '../features/identity/components/login-form';
import { parseRedirect } from '../features/identity/domain/redirect';
import { fetchSession } from '../features/identity/session';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    // Already signed in: nothing to do here.
    if (await fetchSession(context.queryClient))
      throw redirect({ href: parseRedirect(search.redirect) });
  },
  head: () => ({ meta: [{ title: 'Entrar · septo' }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">septo</h1>
        <p className="mt-1 mb-6 text-muted-foreground">Entre para continuar.</p>
        <LoginForm redirect={redirect} />
      </div>
    </main>
  );
}
