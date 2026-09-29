import type { ResumoOS } from '@oficinatrack/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CartaoOS } from './cartao-os';

type ListaOsProps = {
  itens: ResumoOS[];
  isLoading: boolean;
  isError: boolean;
  onTentarDeNovo: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onCarregarMais: () => void;
  mensagemVazia?: string;
};

/** Lista paginada de OS, reusada no histórico da ficha do cliente e da ficha do veículo. */
export function ListaOS({
  itens,
  isLoading,
  isError,
  onTentarDeNovo,
  hasNextPage,
  isFetchingNextPage,
  onCarregarMais,
  mensagemVazia = 'Nenhuma OS por aqui ainda.',
}: ListaOsProps) {
  return (
    <div className="flex flex-col gap-3">
      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Não foi possível carregar o histórico de OS.
            <Button type="button" variant="outline" className="h-11" onClick={onTentarDeNovo}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading &&
        !isError &&
        (itens.length === 0 ? (
          <p className="text-muted-foreground">{mensagemVazia}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {itens.map((item) => (
              <CartaoOS key={item.id} os={item} />
            ))}
          </ul>
        ))}

      {hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-center"
          disabled={isFetchingNextPage}
          onClick={onCarregarMais}
        >
          {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
        </Button>
      )}
    </div>
  );
}
