import { Button } from '@septo/ui/components/button';
import { SidebarTrigger } from '@septo/ui/components/sidebar';
import { SearchIcon } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { UserMenu } from '../../features/identity/components/user-menu';
import { CommandPalette } from './command-palette';

export function AppHeader() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const shortcut = useShortcutLabel();

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur">
      <SidebarTrigger aria-label="Alternar menu lateral" />
      {/* The sidebar (and its wordmark) is a drawer on mobile, so the header carries the name there. */}
      <span className="font-semibold tracking-tight md:hidden">septo</span>

      <Button
        variant="outline"
        size="sm"
        aria-label="Buscar"
        onClick={() => setPaletteOpen(true)}
        className="ml-auto text-muted-foreground md:w-64 md:justify-start"
      >
        <SearchIcon />
        <span className="max-md:sr-only">Buscar</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-sans text-xs max-md:hidden">
          {shortcut}
        </kbd>
      </Button>
      <UserMenu />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}

const noop = () => () => {};

/** ⌘K on Apple devices, Ctrl K elsewhere; the server renders ⌘K and the client corrects it. */
function useShortcutLabel() {
  const isApple = useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
  return isApple ? '⌘K' : 'Ctrl K';
}
