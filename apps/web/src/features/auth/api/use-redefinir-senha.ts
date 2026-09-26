import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRedefinirSenha() {
  return useMutation({
    mutationFn: (dados: { token: string; senha: string }) =>
      api<{ mensagem: string }>('/auth/redefinir-senha', { method: 'POST', body: JSON.stringify(dados) }),
  });
}
