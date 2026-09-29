import type { AlterarVeiculo, FichaVeiculo } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlterarVeiculo(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AlterarVeiculo) => api<FichaVeiculo>(`/veiculos/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: (ficha) => {
      cliente.setQueryData(['veiculo', id], ficha);
      // Placa/modelo mudam o que aparece nos cartões de OS (CartaoOS usa `os.placa`/`os.modelo`): sem
      // isso, o histórico desta ficha e a lista de OS em aberto ficam desatualizados até o refetch de 25s.
      void cliente.invalidateQueries({ queryKey: ['veiculo', id, 'ordens-servico'] });
      void cliente.invalidateQueries({ queryKey: ['busca'] });
      void cliente.invalidateQueries({ queryKey: ['os-abertas'] });
      void cliente.invalidateQueries({ queryKey: ['os'] });
    },
  });
}
