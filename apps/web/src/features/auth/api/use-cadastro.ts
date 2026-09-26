import type { Cadastro } from '@oficinatrack/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCadastro() {
  return useMutation({
    mutationFn: (dados: Cadastro) =>
      api<{ mensagem: string }>('/auth/cadastro', { method: 'POST', body: JSON.stringify(dados) }),
  });
}
