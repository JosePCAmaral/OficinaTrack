import type { DetalheOS } from '@oficinatrack/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDetalheOs(id: string | undefined) {
  return useQuery({
    queryKey: ['os', id],
    queryFn: () => api<DetalheOS>(`/ordens-servico/${id}`),
    enabled: !!id,
  });
}
