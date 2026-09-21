import { Card, CardDescription, CardHeader, CardTitle } from '@septo/ui/components/card';
import { createFileRoute, Link } from '@tanstack/react-router';
import { tools } from '../../../features/dev-tools/domain/tools';
import { Page } from '../../../shared/layout/page';

export const Route = createFileRoute('/_app/dev-tools/')({
  component: DevToolsIndex,
});

function DevToolsIndex() {
  return (
    <Page
      title="Dev Tools"
      description="Ferramentas de bolso que rodam inteiras no seu navegador: nada é enviado para o servidor nem guardado ao sair."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Card className="h-full transition-shadow hover:ring-brand-text/40">
                <CardHeader>
                  <Icon className="mb-2 size-5 text-brand-text" aria-hidden="true" />
                  <CardTitle>{tool.label}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
