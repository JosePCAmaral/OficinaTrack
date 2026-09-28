import type { EventoOSDto, Pagina } from '@oficinatrack/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Eventos da OS, mais novos primeiro; "Carregar anteriores" pede a próxima página pelo cursor. */
export function useEventosOs(osId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['os', osId, 'eventos'],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api<Pagina<EventoOSDto>>(`/ordens-servico/${osId}/eventos${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultimaPagina) => ultimaPagina.proximoCursor ?? undefined,
    enabled: !!osId,
  });
}
