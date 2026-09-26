import type { RespostaSessao } from '@oficinatrack/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useConfirmarEmail() {
  return useMutation({
    mutationFn: (token: string) =>
      api<RespostaSessao>('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token }) }),
  });
}
