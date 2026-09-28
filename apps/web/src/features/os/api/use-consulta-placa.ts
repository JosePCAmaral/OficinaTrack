import type { ConsultaPlaca } from '@oficinatrack/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Disparada manualmente (blur do campo placa), não por render: por isso é `useMutation`
 * e não `useQuery`. Placa desconhecida (404) é tratada pela tela, não aqui.
 */
export function useConsultaPlaca() {
  return useMutation({
    mutationFn: (placa: string) => api<ConsultaPlaca>(`/veiculos/consulta?placa=${encodeURIComponent(placa)}`),
  });
}
