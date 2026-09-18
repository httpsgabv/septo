import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@septo/ui/components/command';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { type NavItem, settingsNavigation, toolsNavigation } from '../navigation';
import { matchesSearch } from '../search';

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const go = (item: NavItem) => {
    onOpenChange(false);
    navigate({ to: item.to });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar no septo"
      description="Digite para encontrar uma ferramenta ou página."
    >
      <Command filter={matchesSearch}>
        <CommandInput placeholder="Buscar ferramentas e páginas" />
        <CommandList>
          <CommandEmpty>Nada encontrado para essa busca.</CommandEmpty>
          <CommandGroup heading="Ferramentas">
            {toolsNavigation.map((item) => (
              <PaletteItem key={item.to} item={item} onSelect={go} />
            ))}
          </CommandGroup>
          <CommandGroup heading="Geral">
            <PaletteItem item={settingsNavigation} onSelect={go} />
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function PaletteItem({ item, onSelect }: { item: NavItem; onSelect: (item: NavItem) => void }) {
  const Icon = item.icon;
  return (
    <CommandItem
      value={item.label}
      keywords={[item.description]}
      onSelect={() => onSelect(item)}
      className="gap-3 py-2 data-selected:[&_svg]:text-brand-text"
    >
      <Icon />
      <span className="shrink-0">{item.label}</span>
      <span className="truncate text-muted-foreground">{item.description}</span>
    </CommandItem>
  );
}
