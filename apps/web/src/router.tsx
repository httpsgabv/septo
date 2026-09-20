import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { routeTree } from './routeTree.gen';
import { setSessionExpiredHandler } from './shared/api/http-client';

export function getRouter() {
  // A fresh QueryClient per request so SSR never shares cache between visitors.
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // React Query owns caching; loaders should always run and delegate to it.
    defaultPreloadStaleTime: 0,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  if (typeof window !== 'undefined') {
    // The session expired mid-use: forget everything cached for the old user and sign in again.
    setSessionExpiredHandler(() => {
      queryClient.clear();
      router.navigate({ to: '/login', search: { redirect: router.state.location.href } });
    });
  }
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
