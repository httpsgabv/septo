import { createFileRoute, Link } from '@tanstack/react-router';
import { tools } from '../../../features/dev-tools/domain/tools';
import { Page } from '../../../shared/layout/page';

export const Route = createFileRoute('/_app/dev-tools/')({
  component: DevToolsIndex,
});

function DevToolsIndex() {
  return (
    <Page title="Dev Tools">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="flex items-center gap-3 rounded-xl border bg-card px-4 py-4 font-medium transition-colors hover:border-brand-text/40 hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Icon className="size-5 shrink-0 text-brand-text" aria-hidden="true" />
              {tool.label}
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
