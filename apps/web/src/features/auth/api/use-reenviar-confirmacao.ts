import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useReenviarConfirmacao() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ mensagem: string }>('/auth/reenviar-confirmacao', { method: 'POST', body: JSON.stringify({ email }) }),
  });
}
