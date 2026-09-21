import { createFileRoute } from '@tanstack/react-router';
import { EncodeTool } from '../../../features/dev-tools/components/encode-tool';

export const Route = createFileRoute('/_app/dev-tools/encode')({
  head: () => ({ meta: [{ title: 'Encodings · Dev Tools · septo' }] }),
  component: EncodeTool,
});
