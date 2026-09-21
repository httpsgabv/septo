import { createFileRoute } from '@tanstack/react-router';
import { RsaTool } from '../../../features/dev-tools/components/rsa-tool';

export const Route = createFileRoute('/_app/dev-tools/rsa')({
  head: () => ({ meta: [{ title: 'Chaves RSA · Dev Tools · septo' }] }),
  component: RsaTool,
});
