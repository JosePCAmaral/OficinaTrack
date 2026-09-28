import type { EventoOSDto, NovoEvento } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePublicarEvento(osId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: NovoEvento) =>
      api<EventoOSDto>(`/ordens-servico/${osId}/eventos`, { method: 'POST', body: JSON.stringify(dados) }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['os', osId, 'eventos'] });
    },
  });
}
