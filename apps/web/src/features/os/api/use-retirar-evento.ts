import type { EventoOSDto } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRetirarEvento(osId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (eventoId: string) => api<EventoOSDto>(`/ordens-servico/${osId}/eventos/${eventoId}/retirar`, { method: 'POST' }),
    // Também no erro: um 422 (já retirada por outra pessoa) deixa a lista local desatualizada.
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: ['os', osId, 'eventos'] });
    },
  });
}
