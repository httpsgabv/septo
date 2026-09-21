import {
  BinaryIcon,
  BookOpenIcon,
  BracesIcon,
  ImageIcon,
  KeyRoundIcon,
  type LucideIcon,
  ReplaceIcon,
} from 'lucide-react';

export type Tool = {
  to:
    | '/dev-tools/json'
    | '/dev-tools/data'
    | '/dev-tools/encode'
    | '/dev-tools/image'
    | '/dev-tools/rsa'
    | '/dev-tools/readme';
  label: string;
  description: string;
  icon: LucideIcon;
};

/** Single source for the index cards, the strip above every tool and each tool's own heading. */
export const tools: Tool[] = [
  {
    to: '/dev-tools/json',
    label: 'JSON',
    description: 'Formatar, minificar e achar onde está o erro.',
    icon: BracesIcon,
  },
  {
    to: '/dev-tools/data',
    label: 'Dados',
    description: 'Converter entre JSON, YAML, CSV e XML.',
    icon: ReplaceIcon,
  },
  {
    to: '/dev-tools/encode',
    label: 'Encodings',
    description: 'base64, base64url, URL e hex, nos dois sentidos.',
    icon: BinaryIcon,
  },
  {
    to: '/dev-tools/image',
    label: 'Imagens',
    description: 'Converter o formato e reduzir o tamanho.',
    icon: ImageIcon,
  },
  {
    to: '/dev-tools/rsa',
    label: 'Chaves RSA',
    description: 'Gerar um par e copiar em PEM.',
    icon: KeyRoundIcon,
  },
  {
    to: '/dev-tools/readme',
    label: 'README',
    description: 'Ler markdown renderizado.',
    icon: BookOpenIcon,
  },
];

export function toolFor(to: Tool['to']): Tool {
  const tool = tools.find((candidate) => candidate.to === to);
  if (!tool) throw new Error(`Unknown tool: ${to}`);
  return tool;
}
