import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@septo/ui/components/sidebar';
import { Link, useLocation } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { findNavItem, type NavItem, settingsNavigation, toolsNavigation } from '../navigation';
import { ApiStatus } from './api-status';

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="septo"
              render={<Link to="/notes" onClick={() => setOpenMobile(false)} />}
            >
              <BrandMark />
              <span className="text-lg font-semibold tracking-tight">septo</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {toolsNavigation.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavLink item={settingsNavigation} />
          <ApiStatus />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { setOpenMobile } = useSidebar();
  const inside = findNavItem(pathname)?.to === item.to;
  // Derived from the route alone, so the server and the client agree on the first render.
  const [expanded, setExpanded] = useState(inside);
  const subId = useId();
  const Icon = item.icon;

  // Entering a tool some other way (⌘K, a link) opens the group; leaving it keeps the user's choice.
  useEffect(() => {
    if (inside) setExpanded(true);
  }, [inside]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={inside}
        tooltip={item.label}
        render={<Link to={item.to} onClick={() => setOpenMobile(false)} />}
        className="data-active:bg-brand-subtle data-active:[&_svg]:text-brand-text"
      >
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {item.children && (
        <>
          <SidebarMenuAction
            aria-expanded={expanded}
            aria-controls={subId}
            aria-label={expanded ? 'Ocultar ferramentas' : 'Mostrar ferramentas'}
            onClick={() => setExpanded((open) => !open)}
            className="aria-expanded:[&>svg]:rotate-90 [&>svg]:transition-transform"
          >
            <ChevronRightIcon />
          </SidebarMenuAction>
          {expanded && (
            <SidebarMenuSub id={subId}>
              {item.children.map((child) => {
                const ChildIcon = child.icon;
                return (
                  <SidebarMenuSubItem key={child.to}>
                    <SidebarMenuSubButton
                      isActive={pathname === child.to}
                      render={<Link to={child.to} onClick={() => setOpenMobile(false)} />}
                      className="data-active:bg-brand-subtle data-active:text-brand-text [&>svg]:text-muted-foreground data-active:[&>svg]:text-brand-text"
                    >
                      <ChildIcon />
                      <span>{child.label}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          )}
        </>
      )}
    </SidebarMenuItem>
  );
}

/** A septum: one surface split in two. */
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8! shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M16 9v14"
        stroke="var(--primary-foreground)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
