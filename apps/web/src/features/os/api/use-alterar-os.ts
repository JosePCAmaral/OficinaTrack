import type { AlterarOs, DetalheOS } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlterarOs(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AlterarOs) => api<DetalheOS>(`/ordens-servico/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: (os) => {
      cliente.setQueryData(['os', id], os);
      void cliente.invalidateQueries({ queryKey: ['os-abertas'] });
    },
  });
}
