import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useEsqueciSenha() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ mensagem: string }>('/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) }),
  });
}
