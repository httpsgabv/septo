import { SidebarTrigger } from '@septo/ui/components/sidebar';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur">
      <SidebarTrigger aria-label="Alternar menu lateral" />
      {/* The sidebar (and its wordmark) is a drawer on mobile, so the header carries the name there. */}
      <span className="font-semibold tracking-tight md:hidden">septo</span>
    </header>
  );
}
