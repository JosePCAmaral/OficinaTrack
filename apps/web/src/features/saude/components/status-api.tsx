import { Button } from '@/components/ui/button';
import { useSaude } from '../api/use-saude';

export function StatusApi() {
  const { isPending, isError, refetch, isFetching } = useSaude();

  if (isPending) {
    return (
      <p role="status" className="h-11 animate-pulse rounded-md bg-muted px-4 leading-[2.75rem] text-muted-foreground">
        Verificando o servidor…
      </p>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
        <p>Não foi possível falar com o servidor.</p>
        <Button className="h-11 self-start" onClick={() => refetch()} disabled={isFetching}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return <p className="rounded-md bg-muted px-4 py-3 font-medium">Sistema no ar</p>;
}
