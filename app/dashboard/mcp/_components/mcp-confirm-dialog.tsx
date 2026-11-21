"use client";

//* Components Imports
import AlertDialog from "@/components/ui/alert-dialog";

type McpConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function McpConfirmDialog({
  open,
  title,
  description,
  actionLabel,
  onOpenChange,
  onConfirm,
}: McpConfirmDialogProps) {
  return (
    <AlertDialog.AlertDialogRoot open={open} onOpenChange={onOpenChange}>
      <AlertDialog.AlertDialogContent>
        <AlertDialog.AlertDialogHeader>
          <AlertDialog.AlertDialogTitle>{title}</AlertDialog.AlertDialogTitle>
          <AlertDialog.AlertDialogDescription>{description}</AlertDialog.AlertDialogDescription>
        </AlertDialog.AlertDialogHeader>
        <AlertDialog.AlertDialogFooter>
          <AlertDialog.AlertDialogCancel>Cancelar</AlertDialog.AlertDialogCancel>
          <AlertDialog.AlertDialogAction variant="destructive" onClick={onConfirm}>
            {actionLabel}
          </AlertDialog.AlertDialogAction>
        </AlertDialog.AlertDialogFooter>
      </AlertDialog.AlertDialogContent>
    </AlertDialog.AlertDialogRoot>
  );
}
