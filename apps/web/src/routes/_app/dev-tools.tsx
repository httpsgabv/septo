import { createFileRoute } from '@tanstack/react-router';
import { CodeXmlIcon } from 'lucide-react';
import { EmptyState, Page } from '../../shared/layout/page';

export const Route = createFileRoute('/_app/dev-tools')({
  head: () => ({ meta: [{ title: 'Dev Tools · septo' }] }),
  component: DevToolsPage,
});

function DevToolsPage() {
  return (
    <Page
      title="Dev Tools"
      description="Formatar JSON, gerar chaves RSA, converter arquivos e ler READMEs."
    >
      <EmptyState icon={CodeXmlIcon} title="Ferramentas a caminho">
        Tudo aqui vai rodar no seu navegador, sem enviar nada para o servidor.
      </EmptyState>
    </Page>
  );
}
