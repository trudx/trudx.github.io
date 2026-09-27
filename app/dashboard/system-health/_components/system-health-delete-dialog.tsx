"use client";

//* Components Imports
import AlertDialog from "@/components/ui/alert-dialog";

type SystemHealthDeleteDialogProps = {
  open: boolean;
  systemName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function SystemHealthDeleteDialog({
  open,
  systemName,
  onOpenChange,
  onConfirm,
}: SystemHealthDeleteDialogProps) {
  return (
    <AlertDialog.AlertDialogRoot open={open} onOpenChange={onOpenChange}>
      <AlertDialog.AlertDialogContent>
        <AlertDialog.AlertDialogHeader>
          <AlertDialog.AlertDialogTitle>Remover sistema?</AlertDialog.AlertDialogTitle>
          <AlertDialog.AlertDialogDescription>
            “{systemName}” e o histórico local de disponibilidade serão removidos deste navegador.
          </AlertDialog.AlertDialogDescription>
        </AlertDialog.AlertDialogHeader>
        <AlertDialog.AlertDialogFooter>
          <AlertDialog.AlertDialogCancel>Cancelar</AlertDialog.AlertDialogCancel>
          <AlertDialog.AlertDialogAction variant="destructive" onClick={onConfirm}>
            Remover
          </AlertDialog.AlertDialogAction>
        </AlertDialog.AlertDialogFooter>
      </AlertDialog.AlertDialogContent>
    </AlertDialog.AlertDialogRoot>
  );
}
