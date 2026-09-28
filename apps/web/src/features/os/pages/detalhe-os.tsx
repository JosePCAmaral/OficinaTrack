import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { usePermissao } from '@/features/auth/hooks/use-permissao';
import { ErroApi } from '@/lib/api';
import { useDetalheOs } from '../api/use-detalhe-os';
import { useEventosOs } from '../api/use-eventos-os';
import { AbaEventos, TIPOS_ABA_CLIENTE, TIPOS_ABA_INTERNA } from '../components/aba-eventos';
import { CabecalhoOS } from '../components/cabecalho-os';
import { EditarOS } from '../components/editar-os';

export function DetalheOs() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const podeGerenciarEquipe = usePermissao('EQUIPE_GERENCIAR');
  const os = useDetalheOs(id);
  const eventos = useEventosOs(id);
  const [editando, setEditando] = useState(false);

  const itensEventos = eventos.data?.pages.flatMap((pagina) => pagina.itens) ?? [];
  const osNaoEncontrada = os.error instanceof ErroApi && os.error.statusCode === 404;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {os.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {os.isError && osNaoEncontrada && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            OS não encontrada.
            <Button asChild type="button" variant="outline" className="h-11">
              <Link to="/painel">Voltar ao início</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {os.isError && !osNaoEncontrada && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Não foi possível carregar a OS.
            <Button type="button" variant="outline" className="h-11" onClick={() => void os.refetch()}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {os.data && (
        <>
          <CabecalhoOS os={os.data} onEditar={() => setEditando(true)} />

          <Tabs defaultValue="cliente">
            <TabsList className="h-auto w-full">
              <TabsTrigger value="cliente" className="h-11">
                Atualizações para o cliente
              </TabsTrigger>
              <TabsTrigger value="internas" className="h-11">
                Notas internas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cliente" className="pt-4">
              <AbaEventos
                os={os.data}
                nomeOficina={usuario?.oficina.nome ?? ''}
                usuarioId={usuario?.id}
                podeGerenciarEquipe={podeGerenciarEquipe}
                tipoPublicar="ATUALIZACAO_CLIENTE"
                tiposExibidos={TIPOS_ABA_CLIENTE}
                rotuloPublicar="Nova atualização para o cliente"
                placeholderPublicar="Ex.: Já identificamos o problema, aguardando a peça chegar."
                eventos={itensEventos}
                isLoading={eventos.isLoading}
                isError={eventos.isError}
                onTentarDeNovo={() => void eventos.refetch()}
                hasNextPage={!!eventos.hasNextPage}
                isFetchingNextPage={eventos.isFetchingNextPage}
                onCarregarAnteriores={() => void eventos.fetchNextPage()}
              />
            </TabsContent>

            <TabsContent value="internas" className="pt-4">
              <AbaEventos
                os={os.data}
                nomeOficina={usuario?.oficina.nome ?? ''}
                usuarioId={usuario?.id}
                podeGerenciarEquipe={podeGerenciarEquipe}
                tipoPublicar="NOTA_INTERNA"
                tiposExibidos={TIPOS_ABA_INTERNA}
                rotuloPublicar="Nova nota interna"
                placeholderPublicar="Ex.: Peça já pedida ao fornecedor."
                eventos={itensEventos}
                isLoading={eventos.isLoading}
                isError={eventos.isError}
                onTentarDeNovo={() => void eventos.refetch()}
                hasNextPage={!!eventos.hasNextPage}
                isFetchingNextPage={eventos.isFetchingNextPage}
                onCarregarAnteriores={() => void eventos.fetchNextPage()}
              />
            </TabsContent>
          </Tabs>

          <EditarOS os={os.data} aberto={editando} onFechar={() => setEditando(false)} />
        </>
      )}
    </div>
  );
}
