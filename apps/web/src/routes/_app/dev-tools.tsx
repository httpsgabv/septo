import { createFileRoute, Outlet } from '@tanstack/react-router';

/** The sidebar lists the tools; this layout only gives them a shared title. */
export const Route = createFileRoute('/_app/dev-tools')({
  head: () => ({ meta: [{ title: 'Dev Tools · septo' }] }),
  component: Outlet,
});
