import type { EventoOSDto } from '@oficinatrack/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { formatarDataHora } from '@/lib/formatar-data';
import { cn } from '@/lib/utils';

type ItemEventoProps = {
  evento: EventoOSDto;
  /** Autor do evento ou quem tem `EQUIPE_GERENCIAR`; nunca aparece se já foi retirado. */
  podeRetirar: boolean;
  retirando: boolean;
  onRetirar: () => void;
  /** Link pronto (`linkWhatsApp` + `mensagemAtualizacao`); só para atualizações ao cliente ainda visíveis. */
  linkWhatsapp: string | null;
};

/** Um evento da OS: marco (OS aberta) ou nota/atualização, com riscado quando retirada. */
export function ItemEvento({ evento, podeRetirar, retirando, onRetirar, linkWhatsapp }: ItemEventoProps) {
  if (evento.tipo === 'OS_ABERTA') {
    return (
      <li className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span>OS aberta · {formatarDataHora(evento.criadoEm)}</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </li>
    );
  }

  const retirado = !!evento.retiradoEm;

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{evento.autor?.nome ?? 'Sistema'}</span>
        <span>{formatarDataHora(evento.criadoEm)}</span>
      </div>

      <p className={cn('whitespace-pre-wrap text-sm', retirado && 'text-muted-foreground line-through')}>{evento.texto}</p>

      {retirado && evento.retiradoPor && (
        <p className="text-xs text-muted-foreground">
          Retirada por {evento.retiradoPor.nome} em {formatarDataHora(evento.retiradoEm!)}
        </p>
      )}

      {!retirado && (linkWhatsapp || podeRetirar) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {linkWhatsapp && (
            <Button asChild type="button" variant="outline" className="h-11">
              <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer">
                Avisar no WhatsApp
              </a>
            </Button>
          )}

          {podeRetirar && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="h-11" disabled={retirando}>
                  {retirando ? 'Retirando…' : 'Retirar'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retirar esta anotação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ela some do histórico visível ao cliente, mas continua registrada internamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11 w-full sm:w-auto">Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="h-11 w-full sm:w-auto" disabled={retirando} onClick={onRetirar}>
                    Sim, retirar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </li>
  );
}
