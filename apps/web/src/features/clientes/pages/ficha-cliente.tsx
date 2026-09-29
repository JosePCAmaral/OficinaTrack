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
import { useFichaCliente } from '../api/use-ficha-cliente';
import { useOsCliente } from '../api/use-os-cliente';
import { EditarCliente } from '../components/editar-cliente';

export function FichaCliente() {
  const { id } = useParams<{ id: string }>();
  const cliente = useFichaCliente(id);
  const osCliente = useOsCliente(id);
  const [editando, setEditando] = useState(false);

  const itensOs = osCliente.data?.pages.flatMap((pagina) => pagina.itens) ?? [];
  const naoEncontrado = cliente.error instanceof ErroApi && cliente.error.statusCode === 404;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {cliente.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {cliente.isError && naoEncontrado && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Cliente não encontrado.
            <Button asChild type="button" variant="outline" className="h-11">
              <Link to="/painel">Voltar ao início</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {cliente.isError && !naoEncontrado && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Não foi possível carregar o cliente.
            <Button type="button" variant="outline" className="h-11" onClick={() => void cliente.refetch()}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {cliente.data && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl uppercase tracking-wide">{cliente.data.nome ?? 'Cliente sem nome'}</h1>
              <p className="text-muted-foreground">{formatarTelefoneExibicao(cliente.data.telefone)}</p>
            </div>
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setEditando(true)}>
              Editar
            </Button>
          </div>

          <dl className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            {cliente.data.email && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">E-mail</dt>
                <dd>{cliente.data.email}</dd>
              </div>
            )}
            {cliente.data.documento && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">CPF/CNPJ</dt>
                <dd>{cliente.data.documento}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Cliente desde</dt>
              <dd>{formatarDataHora(cliente.data.criadoEm)}</dd>
            </div>
          </dl>

          {cliente.data.observacoes && (
            <div className="flex flex-col gap-1 rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observações · Só a oficina vê</p>
              <p className="whitespace-pre-wrap text-sm">{cliente.data.observacoes}</p>
            </div>
          )}

          <section aria-labelledby="titulo-veiculos-cliente" className="flex flex-col gap-3">
            <h2 id="titulo-veiculos-cliente" className="font-display text-lg uppercase tracking-wide">
              Veículos
            </h2>
            {cliente.data.veiculos.length === 0 ? (
              <p className="text-muted-foreground">Nenhum veículo cadastrado para este cliente.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {cliente.data.veiculos.map((veiculo) => (
                  <li key={veiculo.id}>
                    <Link
                      to={`/painel/veiculos/${veiculo.id}`}
                      className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="font-medium">
                        {formatarPlaca(veiculo.placa)}
                        {veiculo.modelo ? ` · ${veiculo.modelo}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-historico-cliente" className="flex flex-col gap-3">
            <h2 id="titulo-historico-cliente" className="font-display text-lg uppercase tracking-wide">
              Histórico de OS
            </h2>
            <ListaOS
              itens={itensOs}
              isLoading={osCliente.isLoading}
              isError={osCliente.isError}
              onTentarDeNovo={() => void osCliente.refetch()}
              hasNextPage={!!osCliente.hasNextPage}
              isFetchingNextPage={osCliente.isFetchingNextPage}
              onCarregarMais={() => void osCliente.fetchNextPage()}
              mensagemVazia="Nenhuma OS para este cliente ainda."
            />
          </section>

          <EditarCliente cliente={cliente.data} aberto={editando} onFechar={() => setEditando(false)} />
        </>
      )}
    </div>
  );
}
