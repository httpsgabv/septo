import { SidebarInset, SidebarProvider } from '@septo/ui/components/sidebar';
import { TooltipProvider } from '@septo/ui/components/tooltip';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { getHealthCheckQueryOptions } from '../shared/api/generated/endpoints/health/health';
import { AppHeader } from '../shared/layout/app-header';
import { AppSidebar } from '../shared/layout/app-sidebar';
import { Page } from '../shared/layout/page';
import { readSidebarOpen } from '../shared/layout/sidebar-state';
import appCss from '../styles.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'septo' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: async ({ context }) => {
    // prefetch (not ensure): the shell must render even when the API is down.
    await context.queryClient.prefetchQuery(getHealthCheckQueryOptions());
    return { sidebarOpen: readSidebarOpen() };
  },
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const { sidebarOpen } = Route.useLoaderData();
  return (
    <RootDocument>
      <TooltipProvider>
        <SidebarProvider defaultOpen={sidebarOpen}>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // ponytail: dark is hardcoded until T11 adds the theme preference
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <Page title="Página não encontrada" description="O endereço não existe ou mudou de lugar.">
      <Link to="/notes" className="text-brand-text underline-offset-4 hover:underline">
        Ir para Notas
      </Link>
    </Page>
  );
}
