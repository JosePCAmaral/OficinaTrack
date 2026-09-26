import type { DadosOficina, DadosOficinaEntrada } from '@oficinatrack/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useOficina() {
  return useQuery({ queryKey: ['oficina'], queryFn: () => api<DadosOficina>('/oficinas/atual') });
}

export function useAtualizarOficina() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosOficinaEntrada) =>
      api<DadosOficina>('/oficinas/atual', { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: (dados) => cliente.setQueryData(['oficina'], dados),
  });
}
