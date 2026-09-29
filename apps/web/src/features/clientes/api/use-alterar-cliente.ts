import type { AlterarCliente, FichaCliente } from '@oficinatrack/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlterarCliente(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: AlterarCliente) => api<FichaCliente>(`/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: (ficha) => {
      cliente.setQueryData(['cliente', id], ficha);
      // Nome/telefone mudam o que aparece nos cartões de OS (CartaoOS usa `os.cliente.nome`): sem isso,
      // o histórico desta ficha e a lista de OS em aberto ficam com o nome antigo até o refetch de 25s.
      void cliente.invalidateQueries({ queryKey: ['cliente', id, 'ordens-servico'] });
      void cliente.invalidateQueries({ queryKey: ['busca'] });
      void cliente.invalidateQueries({ queryKey: ['os-abertas'] });
      void cliente.invalidateQueries({ queryKey: ['os'] });
    },
  });
}
