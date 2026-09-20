import { Button } from '@septo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@septo/ui/components/dialog';

export function DeleteNoteDialog({
  open,
  onOpenChange,
  title,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Excluir esta nota?</DialogTitle>
          <DialogDescription>
            {title ? `“${title}”` : 'Esta nota'} será excluída de vez e não dá para desfazer. Para
            tirá-la da lista sem perder o conteúdo, arquive.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            Excluir de vez
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
