import type { Pagina, ResumoOS } from '@oficinatrack/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Atualiza sozinha a cada 25s, como o quadro do pátio (20-30s), para números novos aparecerem sem F5. */
const INTERVALO_ATUALIZACAO_MS = 25_000;

export function useOsAbertas() {
  return useInfiniteQuery({
    queryKey: ['os-abertas'],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api<Pagina<ResumoOS>>(`/ordens-servico?situacao=abertas${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultimaPagina) => ultimaPagina.proximoCursor ?? undefined,
    refetchInterval: INTERVALO_ATUALIZACAO_MS,
  });
}
