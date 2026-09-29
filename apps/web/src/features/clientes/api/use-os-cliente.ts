import type { Pagina, ResumoOS } from '@oficinatrack/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useOsCliente(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['cliente', id, 'ordens-servico'],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api<Pagina<ResumoOS>>(`/clientes/${id}/ordens-servico${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultimaPagina) => ultimaPagina.proximoCursor ?? undefined,
    enabled: !!id,
  });
}
