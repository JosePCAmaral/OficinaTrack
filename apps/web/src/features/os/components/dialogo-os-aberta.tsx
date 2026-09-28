import { formatarNumeroOS } from '@oficinatrack/shared';
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
import { tempoDesde } from '@/lib/formatar-data';

export type OsAbertaExistente = { id: string; numero: number; criadoEm: string };

type DialogoOsAbertaProps = {
  aberto: boolean;
  os: OsAbertaExistente | null;
  pendente: boolean;
  onAbrirExistente: (os: OsAbertaExistente) => void;
  onCriarMesmoAssim: () => void;
  onCancelar: () => void;
};

/** D4: carro já tem OS em aberto. Nunca bloqueia — só avisa e deixa escolher. */
export function DialogoOsAberta({ aberto, os, pendente, onAbrirExistente, onCriarMesmoAssim, onCancelar }: DialogoOsAbertaProps) {
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && onCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Este carro já está em uma OS</AlertDialogTitle>
          {os && (
            <AlertDialogDescription>
              Este carro já está na OS {formatarNumeroOS(os.numero)}, aberta {tempoDesde(os.criadoEm)}.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 w-full sm:w-auto">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            className="h-11 w-full sm:w-auto"
            disabled={pendente || !os}
            onClick={() => os && onAbrirExistente(os)}
          >
            {os ? `Abrir ${formatarNumeroOS(os.numero)}` : 'Abrir OS existente'}
          </AlertDialogAction>
          <AlertDialogAction className="h-11 w-full sm:w-auto" disabled={pendente} onClick={onCriarMesmoAssim}>
            Criar nova mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
