import { formatarPlaca } from '@oficinatrack/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarTelefoneExibicao } from '@/features/os/components/campo-telefone';
import { ListaOS } from '@/features/os/components/lista-os';
import { ErroApi } from '@/lib/api';
import { formatarDataHora } from '@/lib/formatar-data';
import { useFichaVeiculo } from '../api/use-ficha-veiculo';
import { useOsVeiculo } from '../api/use-os-veiculo';
import { EditarVeiculo } from '../components/editar-veiculo';

function formatarKm(km: number): string {
  return `${new Intl.NumberFormat('pt-BR').format(km)} km`;
}

export function FichaVeiculo() {
  const { id } = useParams<{ id: string }>();
  const veiculo = useFichaVeiculo(id);
  const osVeiculo = useOsVeiculo(id);
  const [editando, setEditando] = useState(false);

  const itensOs = osVeiculo.data?.pages.flatMap((pagina) => pagina.itens) ?? [];
  const naoEncontrado = veiculo.error instanceof ErroApi && veiculo.error.statusCode === 404;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {veiculo.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {veiculo.isError && naoEncontrado && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Veículo não encontrado.
            <Button asChild type="button" variant="outline" className="h-11">
              <Link to="/painel">Voltar ao início</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {veiculo.isError && !naoEncontrado && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Não foi possível carregar o veículo.
            <Button type="button" variant="outline" className="h-11" onClick={() => void veiculo.refetch()}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {veiculo.data && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl uppercase tracking-wide">{formatarPlaca(veiculo.data.placa)}</h1>
              <p className="text-muted-foreground">
                {[veiculo.data.marca, veiculo.data.modelo].filter(Boolean).join(' ') || 'Marca e modelo não informados'}
              </p>
            </div>
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setEditando(true)}>
              Editar
            </Button>
          </div>

          <Button asChild className="h-11">
            <Link to={`/painel/os/nova?placa=${encodeURIComponent(veiculo.data.placa)}`}>Abrir OS para este carro</Link>
          </Button>

          <dl className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            {veiculo.data.anoModelo !== null && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Ano</dt>
                <dd>{veiculo.data.anoModelo}</dd>
              </div>
            )}
            {veiculo.data.cor && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Cor</dt>
                <dd>{veiculo.data.cor}</dd>
              </div>
            )}
            {veiculo.data.chassi && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Chassi</dt>
                <dd>{veiculo.data.chassi}</dd>
              </div>
            )}
            {veiculo.data.kmAtual !== null && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Km atual</dt>
                <dd>{formatarKm(veiculo.data.kmAtual)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Cadastrado em</dt>
              <dd>{formatarDataHora(veiculo.data.criadoEm)}</dd>
            </div>
          </dl>

          <section aria-labelledby="titulo-dono-veiculo" className="flex flex-col gap-3">
            <h2 id="titulo-dono-veiculo" className="font-display text-lg uppercase tracking-wide">
              Dono
            </h2>
            <Link
              to={`/painel/clientes/${veiculo.data.cliente.id}`}
              className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-medium">{veiculo.data.cliente.nome ?? 'Cliente sem nome'}</p>
              <p className="text-sm text-muted-foreground">{formatarTelefoneExibicao(veiculo.data.cliente.telefone)}</p>
            </Link>
          </section>

          <section aria-labelledby="titulo-historico-veiculo" className="flex flex-col gap-3">
            <h2 id="titulo-historico-veiculo" className="font-display text-lg uppercase tracking-wide">
              Histórico de OS
            </h2>
            <ListaOS
              itens={itensOs}
              isLoading={osVeiculo.isLoading}
              isError={osVeiculo.isError}
              onTentarDeNovo={() => void osVeiculo.refetch()}
              hasNextPage={!!osVeiculo.hasNextPage}
              isFetchingNextPage={osVeiculo.isFetchingNextPage}
              onCarregarMais={() => void osVeiculo.fetchNextPage()}
              mensagemVazia="Nenhuma OS para este veículo ainda."
            />
          </section>

          <EditarVeiculo veiculo={veiculo.data} aberto={editando} onFechar={() => setEditando(false)} />
        </>
      )}
    </div>
  );
}
