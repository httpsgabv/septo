import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@septo/ui/components/sidebar';
import { Link, useLocation } from '@tanstack/react-router';
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
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={findNavItem(pathname)?.to === item.to}
        tooltip={item.label}
        render={<Link to={item.to} onClick={() => setOpenMobile(false)} />}
        className="data-active:bg-brand-subtle data-active:[&_svg]:text-brand-text"
      >
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
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
