import type { AbrirOs, DetalheOS } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAbrirOs() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AbrirOs) => api<DetalheOS>('/ordens-servico', { method: 'POST', body: JSON.stringify(dados) }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['os-abertas'] });
    },
  });
}
