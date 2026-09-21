import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { tools } from '../../features/dev-tools/domain/tools';

/** Layout for the tool belt: a strip to jump between tools, and the open tool below it. */
export const Route = createFileRoute('/_app/dev-tools')({
  head: () => ({ meta: [{ title: 'Dev Tools · septo' }] }),
  component: DevToolsLayout,
});

function DevToolsLayout() {
  const { pathname } = useLocation();
  // The index already shows the six as cards; the strip would only repeat it.
  const onIndex = pathname.replace(/\/$/, '') === '/dev-tools';

  return (
    <>
      {!onIndex && (
        <nav
          aria-label="Ferramentas"
          className="flex gap-1 overflow-x-auto border-b px-4 py-2 sm:px-6 md:px-10"
        >
          {tools.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:bg-brand-subtle data-[status=active]:text-brand-text"
            >
              {tool.label}
            </Link>
          ))}
        </nav>
      )}
      <Outlet />
    </>
  );
}
