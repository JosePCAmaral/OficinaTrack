import type { EventoOSDto } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRetirarEvento(osId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (eventoId: string) => api<EventoOSDto>(`/ordens-servico/${osId}/eventos/${eventoId}/retirar`, { method: 'POST' }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['os', osId, 'eventos'] });
    },
  });
}
