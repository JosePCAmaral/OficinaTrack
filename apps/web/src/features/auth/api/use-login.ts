import type { Login, RespostaSessao } from '@oficinatrack/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLogin() {
  return useMutation({
    mutationFn: (dados: Login) => api<RespostaSessao>('/auth/login', { method: 'POST', body: JSON.stringify(dados) }),
  });
}
