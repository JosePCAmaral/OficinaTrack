import type { AlterarOs, DetalheOS } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlterarOs(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AlterarOs) => api<DetalheOS>(`/ordens-servico/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: (os) => {
      cliente.setQueryData(['os', id], os);
      // Km, queixa, responsável e previsão aparecem nos históricos das fichas e na busca.
      void cliente.invalidateQueries({ queryKey: ['os-abertas'] });
      void cliente.invalidateQueries({ queryKey: ['os', id, 'eventos'] });
      void cliente.invalidateQueries({ queryKey: ['veiculo'] });
      void cliente.invalidateQueries({ queryKey: ['cliente'] });
      void cliente.invalidateQueries({ queryKey: ['busca'] });
    },
  });
}
