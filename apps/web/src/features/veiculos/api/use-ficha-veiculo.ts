import type { FichaVeiculo } from '@oficinatrack/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useFichaVeiculo(id: string | undefined) {
  return useQuery({
    queryKey: ['veiculo', id],
    queryFn: () => api<FichaVeiculo>(`/veiculos/${id}`),
    enabled: !!id,
  });
}
