import { Button } from '@septo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@septo/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@septo/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@septo/ui/components/dropdown-menu';
import { Input } from '@septo/ui/components/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@septo/ui/components/tooltip';
import { createFileRoute } from '@tanstack/react-router';
import {
  getHealthCheckQueryOptions,
  useHealthCheck,
} from '../shared/api/generated/endpoints/health/health';

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getHealthCheckQueryOptions()),
  component: Home,
});

// ponytail: temporary design-system preview; T9 replaces this page with the app shell
function Home() {
  const { data } = useHealthCheck();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">septo</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.documentElement.classList.toggle('dark')}
        >
          Alternar tema
        </Button>
      </header>

      <p data-testid="api-status" className="text-muted-foreground">
        API: {data?.status ?? 'indisponível'}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button>Salvar nota</Button>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="outline">Exportar</Button>
        <Button variant="ghost">Arquivar</Button>
        <Button variant="destructive">Excluir</Button>
        <Button variant="link">Ver todas</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ideia para o septo</CardTitle>
          <CardDescription>Criada hoje às 09:12</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Buscar notas" />
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline">Dica</Button>} />
            <TooltipContent>Atalho: ⌘K</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      <p className="text-brand-text">
        Texto em acento com contraste AA.{' '}
        <a className="underline" href="/">
          Link de exemplo
        </a>
      </p>

      <div className="flex gap-2">
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Abrir diálogo</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir nota?</DialogTitle>
              <DialogDescription>A nota vai para a lixeira por 30 dias.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">Mais ações</Button>} />
          <DropdownMenuContent>
            <DropdownMenuItem>Fixar</DropdownMenuItem>
            <DropdownMenuItem>Duplicar</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </main>
  );
}
