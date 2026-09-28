import { formatarNumeroOS, formatarPlaca, type DetalheOS, type StatusOS } from '@oficinatrack/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { linkWhatsApp } from '@/lib/whatsapp';

export const LABEL_STATUS_OS: Record<StatusOS, string> = {
  TRIAGEM: 'Triagem',
  DIAGNOSTICO: 'Diagnóstico',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  AGUARDANDO_PECA: 'Aguardando peça',
  EM_EXECUCAO: 'Em execução',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

function formatarPrevisao(data: string | null): string | null {
  if (!data) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${data}T00:00:00`));
}

type CabecalhoOsProps = {
  os: DetalheOS;
  onEditar: () => void;
};

export function CabecalhoOS({ os, onEditar }: CabecalhoOsProps) {
  const veiculoLinha = [os.veiculo.modelo, os.veiculo.cor].filter(Boolean).join(' · ');
  const previsao = formatarPrevisao(os.previsaoEntrega);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-display text-2xl tracking-wide">{formatarNumeroOS(os.numero)}</span>
          <p className="font-medium">
            {formatarPlaca(os.veiculo.placa)}
            {veiculoLinha ? ` · ${veiculoLinha}` : ''}
          </p>
        </div>
        <Badge variant="secondary">{LABEL_STATUS_OS[os.status]}</Badge>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm">{os.cliente.nome ?? 'Cliente sem nome'}</p>
        <Button asChild variant="outline" className="h-11 shrink-0">
          <a href={linkWhatsApp(os.cliente.telefone, '')} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Km de entrada</dt>
          <dd>{os.kmEntrada !== null ? new Intl.NumberFormat('pt-BR').format(os.kmEntrada) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Responsável</dt>
          <dd>{os.responsavel?.nome ?? 'Ninguém'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Previsão de entrega</dt>
          <dd>{previsao ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Queixa do cliente</p>
        <p className="whitespace-pre-wrap text-sm">{os.relatoCliente}</p>
      </div>

      {os.diagnostico && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Diagnóstico</p>
          <p className="whitespace-pre-wrap text-sm">{os.diagnostico}</p>
        </div>
      )}

      <Button type="button" variant="outline" className="h-11 self-start" onClick={onEditar}>
        Editar
      </Button>
    </div>
  );
}
