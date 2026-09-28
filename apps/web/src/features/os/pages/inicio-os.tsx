import { Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useOsAbertas } from '../api/use-os-abertas';
import { CartaoOS } from '../components/cartao-os';

function BuscaTopo() {
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const q = termo.trim();
    if (!q) return;
    navigate(`/painel/busca?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={aoEnviar} className="flex items-center gap-2" role="search">
      <Label htmlFor="busca-topo" className="sr-only">
        Buscar por placa, nome ou telefone
      </Label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="busca-topo"
          type="search"
          placeholder="Buscar por placa, nome ou telefone"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          className="h-11 pl-9"
        />
      </div>
      <Button type="submit" variant="outline" className="h-11">
        Buscar
      </Button>
    </form>
  );
}

export function InicioOs() {
  const os = useOsAbertas();
  const itens = os.data?.pages.flatMap((pagina) => pagina.itens) ?? [];

  return (
    <div className="flex flex-col gap-6 pb-20">
      <BuscaTopo />

      <section aria-labelledby="titulo-os-abertas" className="flex flex-col gap-3">
        <h1 id="titulo-os-abertas" className="font-display text-2xl uppercase tracking-wide">
          OS em aberto
        </h1>

        {os.isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {os.isError && (
          <Alert variant="destructive">
            <AlertDescription className="flex w-full items-center justify-between gap-3">
              Não foi possível carregar as OS em aberto.
              <Button type="button" variant="outline" className="h-11" onClick={() => void os.refetch()}>
                Tentar de novo
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {os.data &&
          (itens.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma OS em aberto. Toque em Abrir OS para começar.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {itens.map((item) => (
                  <CartaoOS key={item.id} os={item} />
                ))}
              </ul>
              {os.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 self-center"
                  disabled={os.isFetchingNextPage}
                  onClick={() => void os.fetchNextPage()}
                >
                  {os.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
                </Button>
              )}
            </>
          ))}
      </section>

      <Button
        asChild
        className="fixed right-4 z-30 h-14 gap-2 rounded-full px-5 shadow-lg"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <Link to="/painel/os/nova">
          <Plus className="size-5" />
          Abrir OS
        </Link>
      </Button>
    </div>
  );
}
