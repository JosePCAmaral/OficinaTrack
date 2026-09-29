import { buscaSchema, formatarPlaca, normalizarPlaca, type ResumoCliente, type ResumoVeiculo } from '@oficinatrack/shared';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarTelefoneExibicao } from '@/features/os/components/campo-telefone';
import { useBusca } from '../api/use-busca';

function CartaoVeiculo({ veiculo }: { veiculo: ResumoVeiculo }) {
  return (
    <li>
      <Link
        to={`/painel/veiculos/${veiculo.id}`}
        className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="font-medium">
          {formatarPlaca(veiculo.placa)}
          {veiculo.modelo ? ` · ${veiculo.modelo}` : ''}
        </p>
        <p className="truncate text-sm text-muted-foreground">{veiculo.cliente.nome ?? 'Cliente sem nome'}</p>
      </Link>
    </li>
  );
}

function CartaoCliente({ cliente }: { cliente: ResumoCliente }) {
  return (
    <li>
      <Link
        to={`/painel/clientes/${cliente.id}`}
        className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="font-medium">{cliente.nome ?? 'Cliente sem nome'}</p>
        <p className="text-sm text-muted-foreground">{formatarTelefoneExibicao(cliente.telefone)}</p>
      </Link>
    </li>
  );
}

type CampoBuscaProps = {
  valorInicial: string;
  onEnviar: (valor: string) => void;
};

/**
 * `key={qUrl}` no componente pai remonta este campo sempre que o termo da URL muda (ex.: link vindo
 * de outra tela), sem precisar de um `useEffect` para sincronizar o estado local com a URL.
 */
function CampoBusca({ valorInicial, onEnviar }: CampoBuscaProps) {
  const [termo, setTermo] = useState(valorInicial);

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    onEnviar(termo.trim());
  }

  return (
    <form onSubmit={aoEnviar} className="flex items-center gap-2" role="search">
      <Label htmlFor="busca-termo" className="sr-only">
        Buscar por placa, nome ou telefone
      </Label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="busca-termo"
          type="search"
          placeholder="Placa, nome ou telefone"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          className="h-11 pl-9"
        />
      </div>
      <Button type="submit" className="h-11">
        Buscar
      </Button>
    </form>
  );
}

export function Busca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qUrl = searchParams.get('q') ?? '';

  function aoEnviarBusca(valor: string) {
    setSearchParams(valor ? { q: valor } : {});
  }

  const validacao = qUrl ? buscaSchema.safeParse({ q: qUrl }) : null;
  const termoValido = validacao?.success ?? false;
  const mensagemSchema = validacao && !validacao.success ? (validacao.error.issues[0]?.message ?? null) : null;

  const resultado = useBusca(qUrl);
  const clientes = resultado.data?.clientes ?? [];
  const veiculos = resultado.data?.veiculos ?? [];
  const semResultado = !!resultado.data && clientes.length === 0 && veiculos.length === 0;
  const placaDoTermo = normalizarPlaca(qUrl);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <h1 className="font-display text-2xl uppercase tracking-wide">Buscar</h1>

      <CampoBusca key={qUrl} valorInicial={qUrl} onEnviar={aoEnviarBusca} />

      {qUrl && !termoValido && mensagemSchema && (
        <p role="alert" className="text-sm text-destructive">
          {mensagemSchema}
        </p>
      )}

      {qUrl && termoValido && resultado.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {qUrl && termoValido && resultado.isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Não foi possível buscar.
            <Button type="button" variant="outline" className="h-11" onClick={() => void resultado.refetch()}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {qUrl && termoValido && resultado.data && (
        <>
          {semResultado ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-muted-foreground">Nada encontrado para &quot;{qUrl}&quot;.</p>
              <Button asChild className="h-11">
                <Link to={placaDoTermo ? `/painel/os/nova?placa=${encodeURIComponent(placaDoTermo)}` : '/painel/os/nova'}>
                  Abrir OS
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {veiculos.length > 0 && (
                <section aria-labelledby="titulo-busca-veiculos" className="flex flex-col gap-3">
                  <h2 id="titulo-busca-veiculos" className="font-display text-lg uppercase tracking-wide">
                    Veículos
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {veiculos.map((v) => (
                      <CartaoVeiculo key={v.id} veiculo={v} />
                    ))}
                  </ul>
                </section>
              )}

              {clientes.length > 0 && (
                <section aria-labelledby="titulo-busca-clientes" className="flex flex-col gap-3">
                  <h2 id="titulo-busca-clientes" className="font-display text-lg uppercase tracking-wide">
                    Clientes
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {clientes.map((c) => (
                      <CartaoCliente key={c.id} cliente={c} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
