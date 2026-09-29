import type { FichaCliente } from '@oficinatrack/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useFichaCliente(id: string | undefined) {
  return useQuery({
    queryKey: ['cliente', id],
    queryFn: () => api<FichaCliente>(`/clientes/${id}`),
    enabled: !!id,
  });
}
