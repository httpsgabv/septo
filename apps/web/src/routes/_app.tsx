import { SidebarInset, SidebarProvider } from '@septo/ui/components/sidebar';
import { TooltipProvider } from '@septo/ui/components/tooltip';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { fetchSession } from '../features/identity/session';
import { getHealthCheckQueryOptions } from '../shared/api/generated/endpoints/health/health';
import { AppHeader } from '../shared/layout/app-header';
import { AppSidebar } from '../shared/layout/app-sidebar';
import { readSidebarOpen } from '../shared/layout/sidebar-state';

/** Layout without a path: everything inside the shell, and behind the login. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    if (!(await fetchSession(context.queryClient))) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  loader: async ({ context }) => {
    // prefetch (not ensure): the shell must render even when the API is down.
    await context.queryClient.prefetchQuery(getHealthCheckQueryOptions());
    return { sidebarOpen: readSidebarOpen() };
  },
  component: AppLayout,
});

function AppLayout() {
  const { sidebarOpen } = Route.useLoaderData();
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
