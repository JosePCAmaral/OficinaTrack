import type { ConviteCriado, ConviteEntrada, ConvitePendente } from '@oficinatrack/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useConvites() {
  return useQuery({ queryKey: ['convites'], queryFn: () => api<ConvitePendente[]>('/convites') });
}

/** As duas listas mudam juntas: convite aceito sai de uma e entra na outra. */
function useInvalidarEquipeEConvites() {
  const cliente = useQueryClient();
  return () => {
    void cliente.invalidateQueries({ queryKey: ['equipe'] });
    void cliente.invalidateQueries({ queryKey: ['convites'] });
  };
}

export function useConvidar() {
  const invalidar = useInvalidarEquipeEConvites();
  return useMutation({
    mutationFn: (dados: ConviteEntrada) => api<ConviteCriado>('/convites', { method: 'POST', body: JSON.stringify(dados) }),
    onSuccess: invalidar,
  });
}

export function useReenviarConvite() {
  const invalidar = useInvalidarEquipeEConvites();
  return useMutation({
    mutationFn: (id: string) => api<ConviteCriado>(`/convites/${id}/reenviar`, { method: 'POST' }),
    onSuccess: invalidar,
  });
}

export function useCancelarConvite() {
  const invalidar = useInvalidarEquipeEConvites();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/convites/${id}`, { method: 'DELETE' }),
    onSuccess: invalidar,
  });
}
