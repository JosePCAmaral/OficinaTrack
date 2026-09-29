import type { AlterarCliente, FichaCliente } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlterarCliente(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AlterarCliente) => api<FichaCliente>(`/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: (ficha) => {
      cliente.setQueryData(['cliente', id], ficha);
      void cliente.invalidateQueries({ queryKey: ['busca'] });
    },
  });
}
