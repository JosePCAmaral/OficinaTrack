import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type TrocarSenhaDados = { senhaAtual: string; novaSenha: string };

export function useTrocarSenha() {
  return useMutation({
    mutationFn: (dados: TrocarSenhaDados) => api<void>('/auth/senha', { method: 'PATCH', body: JSON.stringify(dados) }),
  });
}
