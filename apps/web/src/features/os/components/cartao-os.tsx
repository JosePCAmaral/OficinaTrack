import { formatarNumeroOS, formatarPlaca, type ResumoOS } from '@oficinatrack/shared';
import { Link } from 'react-router';
import { tempoDesde } from '@/lib/formatar-data';

export function CartaoOS({ os }: { os: ResumoOS }) {
  return (
    <li>
      <Link
        to={`/painel/os/${os.id}`}
        className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-lg tracking-wide">{formatarNumeroOS(os.numero)}</span>
          <span className="text-sm text-muted-foreground">{tempoDesde(os.criadoEm)}</span>
        </div>
        <p className="font-medium">
          {formatarPlaca(os.placa)}
          {os.modelo ? ` · ${os.modelo}` : ''}
        </p>
        <p className="truncate text-sm text-muted-foreground">{os.cliente.nome ?? 'Cliente sem nome'}</p>
      </Link>
    </li>
  );
}
