import type { ConviteCriado, ConvitePendente } from '@oficinatrack/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErroApi } from '@/lib/api';
import { formatarDataHora } from '@/lib/formatar-data';
import { useCancelarConvite, useReenviarConvite } from '../api/use-convites';
import { LinkConvite } from './link-convite';

function ItemConvite({ convite, nomeOficina }: { convite: ConvitePendente; nomeOficina: string }) {
  const reenviar = useReenviarConvite();
  const cancelar = useCancelarConvite();
  const [linkAtual, setLinkAtual] = useState<ConviteCriado | null>(null);
  // limite de reenvios atingido (429): a mensagem da API fica visível e diz o que fazer (cancelar e convidar de novo)
  const [limiteReenvio, setLimiteReenvio] = useState<string | null>(null);

  async function aoReenviar() {
    try {
      setLinkAtual(await reenviar.mutateAsync(convite.id));
    } catch (erro) {
      if (erro instanceof ErroApi && erro.statusCode === 429) {
        setLimiteReenvio(erro.message);
        return;
      }
      toast.error(erro instanceof ErroApi ? erro.message : 'Não foi possível completar a ação. Tente de novo.');
    }
  }

  async function aoCancelar() {
    try {
      await cancelar.mutateAsync(convite.id);
    } catch (erro) {
      toast.error(erro instanceof ErroApi ? erro.message : 'Não foi possível completar a ação. Tente de novo.');
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{convite.nome}</p>
          <p className="truncate text-sm text-muted-foreground">{convite.email}</p>
        </div>
        <p className="shrink-0 text-right text-xs text-muted-foreground">Expira em {formatarDataHora(convite.expiraEm)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => void aoReenviar()}
          disabled={reenviar.isPending || limiteReenvio !== null}
        >
          {reenviar.isPending ? 'Reenviando…' : 'Reenviar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 text-destructive"
          onClick={() => void aoCancelar()}
          disabled={cancelar.isPending}
        >
          Cancelar
        </Button>
      </div>
      {limiteReenvio && (
        <p role="alert" className="text-sm text-destructive">
          {limiteReenvio}
        </p>
      )}
      {linkAtual && <LinkConvite convite={linkAtual} nomeOficina={nomeOficina} />}
    </li>
  );
}

export function ListaConvites({ convites, nomeOficina }: { convites: ConvitePendente[]; nomeOficina: string }) {
  return (
    <ul className="flex flex-col gap-3">
      {convites.map((convite) => (
        <ItemConvite key={convite.id} convite={convite} nomeOficina={nomeOficina} />
      ))}
    </ul>
  );
}
