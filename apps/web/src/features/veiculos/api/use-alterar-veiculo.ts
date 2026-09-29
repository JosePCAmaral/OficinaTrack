import type { AlterarVeiculo, FichaVeiculo } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlterarVeiculo(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AlterarVeiculo) => api<FichaVeiculo>(`/veiculos/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: (ficha) => {
      cliente.setQueryData(['veiculo', id], ficha);
      void cliente.invalidateQueries({ queryKey: ['busca'] });
    },
  });
}
