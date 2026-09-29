import type { AbrirOs, DetalheOS } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAbrirOs() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AbrirOs) => api<DetalheOS>('/ordens-servico', { method: 'POST', body: JSON.stringify(dados) }),
    onSuccess: () => {
      // Abertura pode criar/atualizar cliente e veículo (e transferir o veículo de dono): fichas,
      // históricos, busca e OS já em cache (que mostram o dono do veículo) ficam desatualizados.
      void cliente.invalidateQueries({ queryKey: ['os-abertas'] });
      void cliente.invalidateQueries({ queryKey: ['os'] });
      void cliente.invalidateQueries({ queryKey: ['veiculo'] });
      void cliente.invalidateQueries({ queryKey: ['cliente'] });
      void cliente.invalidateQueries({ queryKey: ['busca'] });
    },
  });
}
