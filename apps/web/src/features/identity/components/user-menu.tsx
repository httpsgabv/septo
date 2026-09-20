import { Button } from '@septo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@septo/ui/components/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { LogOutIcon, UserRoundIcon } from 'lucide-react';
import { useAuthLogout } from '../../../shared/api/generated/endpoints/auth/auth';
import { useMeGet } from '../../../shared/api/generated/endpoints/me/me';

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Already in the cache: the route guard fetched it before the shell rendered.
  const { data: me } = useMeGet();
  const logout = useAuthLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        router.history.push('/login');
      },
    },
  });

  if (!me) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" aria-label="Menu do usuário" />}
      >
        <UserRoundIcon />
        <span className="max-w-32 truncate max-md:sr-only">{me.displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-foreground">{me.displayName}</span>
            <span>@{me.username}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={logout.isPending} onClick={() => logout.mutate()}>
          <LogOutIcon />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
