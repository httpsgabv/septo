import { Link } from '@tanstack/react-router';
import { Page } from './page';

export function NotFound() {
  return (
    <Page title="Página não encontrada" description="O endereço não existe ou mudou de lugar.">
      <Link to="/notes" className="text-brand-text underline-offset-4 hover:underline">
        Ir para Notas
      </Link>
    </Page>
  );
}
