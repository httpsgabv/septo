import { createFileRoute } from '@tanstack/react-router';
import { JsonTool } from '../../../features/dev-tools/components/json-tool';

export const Route = createFileRoute('/_app/dev-tools/json')({
  head: () => ({ meta: [{ title: 'JSON · Dev Tools · septo' }] }),
  component: JsonTool,
});
