import type { DetalheOS, EventoOSDto, TipoEvento } from '@oficinatrack/shared';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ErroApi } from '@/lib/api';
import { linkWhatsApp, mensagemAtualizacao } from '@/lib/whatsapp';
import { usePublicarEvento } from '../api/use-publicar-evento';
import { useRetirarEvento } from '../api/use-retirar-evento';
import { ItemEvento } from './item-evento';

const TEXTO_MAX = 2000;

/** Mensagem amigável para uma falha ao retirar uma atualização. */
function mensagemErroRetirar(erro: unknown): string {
  if (erro instanceof ErroApi) {
    if (erro.statusCode === 403) return 'Você não pode retirar esta atualização.';
    if (erro.statusCode === 422) return 'Esta atualização já foi retirada ou não pode ser retirada.';
    if (erro.statusCode === 404) return 'Esta atualização não foi encontrada. Atualize a tela.';
  }
  return 'Não foi possível retirar a atualização. Tente de novo.';
}

/** Tipos de evento internos, além dos publicáveis (`COMENTARIO` é obsoleto, mas se aparecer conta como interno). */
export const TIPOS_ABA_INTERNA: TipoEvento[] = ['NOTA_INTERNA', 'VEICULO_TRANSFERIDO', 'COMENTARIO'];
export const TIPOS_ABA_CLIENTE: TipoEvento[] = ['ATUALIZACAO_CLIENTE'];

type AbaEventosProps = {
  os: DetalheOS;
  nomeOficina: string;
  usuarioId: string | undefined;
  podeGerenciarEquipe: boolean;
  tipoPublicar: 'NOTA_INTERNA' | 'ATUALIZACAO_CLIENTE';
  tiposExibidos: TipoEvento[];
  rotuloPublicar: string;
  placeholderPublicar: string;
  eventos: EventoOSDto[];
  isLoading: boolean;
  isError: boolean;
  onTentarDeNovo: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onCarregarAnteriores: () => void;
};

/** Lista filtrada de eventos (`OS_ABERTA` aparece nas duas abas como marco) + campo de publicação. */
export function AbaEventos({
  os,
  nomeOficina,
  usuarioId,
  podeGerenciarEquipe,
  tipoPublicar,
  tiposExibidos,
  rotuloPublicar,
  placeholderPublicar,
  eventos,
  isLoading,
  isError,
  onTentarDeNovo,
  hasNextPage,
  isFetchingNextPage,
  onCarregarAnteriores,
}: AbaEventosProps) {
  const [texto, setTexto] = useState('');
  const [retirandoId, setRetirandoId] = useState<string | null>(null);
  const [erroRetirar, setErroRetirar] = useState<string | null>(null);
  const publicar = usePublicarEvento(os.id);
  const retirar = useRetirarEvento(os.id);

  const itens = eventos.filter((evento) => evento.tipo === 'OS_ABERTA' || tiposExibidos.includes(evento.tipo));

  async function aoPublicar() {
    const valor = texto.trim();
    if (!valor) return;
    try {
      await publicar.mutateAsync({ tipo: tipoPublicar, texto: valor });
      setTexto('');
    } catch {
      // erro genérico fica visível pelo alerta abaixo do campo
    }
  }

  async function aoRetirar(eventoId: string) {
    setRetirandoId(eventoId);
    setErroRetirar(null);
    try {
      await retirar.mutateAsync(eventoId);
    } catch (erro) {
      setErroRetirar(mensagemErroRetirar(erro));
    } finally {
      setRetirandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            Não foi possível carregar os eventos.
            <Button type="button" variant="outline" className="h-11" onClick={onTentarDeNovo}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {erroRetirar && (
        <Alert variant="destructive">
          <AlertDescription>{erroRetirar}</AlertDescription>
        </Alert>
      )}

      {!isLoading &&
        !isError &&
        (itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {itens.map((evento) => {
              // A API só permite retirar ATUALIZACAO_CLIENTE (422 EVENTO_NAO_RETIRAVEL para os demais);
              // D3 é sobre tirar uma atualização do portal do cliente, não sobre notas internas.
              const podeRetirar =
                !evento.retiradoEm &&
                !!evento.autor &&
                evento.tipo === 'ATUALIZACAO_CLIENTE' &&
                (evento.autor.id === usuarioId || podeGerenciarEquipe);
              const mostrarWhatsapp = evento.tipo === 'ATUALIZACAO_CLIENTE' && !evento.retiradoEm && !!evento.texto;
              const linkWhatsappItem = mostrarWhatsapp
                ? linkWhatsApp(
                    os.cliente.telefone,
                    mensagemAtualizacao({
                      nomeCliente: os.cliente.nome,
                      nomeOficina,
                      veiculo: os.veiculo,
                      texto: evento.texto ?? '',
                    }),
                  )
                : null;
              return (
                <ItemEvento
                  key={evento.id}
                  evento={evento}
                  podeRetirar={podeRetirar}
                  retirando={retirandoId === evento.id}
                  onRetirar={() => void aoRetirar(evento.id)}
                  linkWhatsapp={linkWhatsappItem}
                />
              );
            })}
          </ul>
        ))}

      {hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-center"
          disabled={isFetchingNextPage}
          onClick={onCarregarAnteriores}
        >
          {isFetchingNextPage ? 'Carregando…' : 'Carregar anteriores'}
        </Button>
      )}

      <div className="flex flex-col gap-2 border-t pt-4">
        {publicar.isError && (
          <Alert variant="destructive">
            <AlertDescription>{(publicar.error as Error).message}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor={`publicar-${tipoPublicar}`}>{rotuloPublicar}</Label>
          <span className="text-xs text-muted-foreground">
            {texto.length}/{TEXTO_MAX}
          </span>
        </div>
        <Textarea
          id={`publicar-${tipoPublicar}`}
          placeholder={placeholderPublicar}
          maxLength={TEXTO_MAX}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Button
          type="button"
          className="h-11 self-end"
          disabled={publicar.isPending || !texto.trim()}
          onClick={() => void aoPublicar()}
        >
          {publicar.isPending ? 'Publicando…' : 'Publicar'}
        </Button>
      </div>
    </div>
  );
}
