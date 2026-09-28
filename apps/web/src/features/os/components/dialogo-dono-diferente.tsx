import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type DonoAtual = { nome: string | null; telefoneFinal: string };

type DialogoDonoDiferenteProps = {
  aberto: boolean;
  dono: DonoAtual | null;
  /** Nome do cliente que está trazendo o carro agora (ou o telefone, se o nome não foi informado). */
  novoDono: string;
  pendente: boolean;
  onSim: () => void;
  onNao: () => void;
  onCancelar: () => void;
};

/** D1: placa já cadastrada com outro cliente. Pergunta se o carro mudou de dono. */
export function DialogoDonoDiferente({ aberto, dono, novoDono, pendente, onSim, onNao, onCancelar }: DialogoDonoDiferenteProps) {
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && onCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>O carro mudou de dono?</AlertDialogTitle>
          {dono && (
            <AlertDialogDescription>
              Esta placa está cadastrada com {dono.nome ?? 'outro cliente'} (…{dono.telefoneFinal}). O carro mudou de dono?
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 w-full sm:w-auto">Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="outline" className="h-11 w-full sm:w-auto" disabled={pendente} onClick={onNao}>
            Não, só está trazendo
          </AlertDialogAction>
          <AlertDialogAction className="h-11 w-full sm:w-auto" disabled={pendente} onClick={onSim}>
            Sim, passar para {novoDono}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
