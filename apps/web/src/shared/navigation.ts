import { CodeXmlIcon, type LucideIcon, NotebookPenIcon, SettingsIcon } from 'lucide-react';

export type NavItem = {
  to: '/notes' | '/dev-tools' | '/settings';
  label: string;
  description: string;
  icon: LucideIcon;
};

/** Single source for the sidebar and the command palette. */
export const toolsNavigation: NavItem[] = [
  {
    to: '/notes',
    label: 'Notas',
    description: 'Ideias, anotações e lembretes',
    icon: NotebookPenIcon,
  },
  {
    to: '/dev-tools',
    label: 'Dev Tools',
    description: 'JSON, chaves RSA, conversores e READMEs',
    icon: CodeXmlIcon,
  },
];

export const settingsNavigation: NavItem = {
  to: '/settings',
  label: 'Configurações',
  description: 'Tema e cor de destaque',
  icon: SettingsIcon,
};

export const allNavigation = [...toolsNavigation, settingsNavigation];

export function findNavItem(pathname: string) {
  return allNavigation.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}
