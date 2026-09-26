import type { RespostaSessao } from '@oficinatrack/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ConviteConsultado = { nomeOficina: string; nome: string; email: string; telefone: string | null };

export function useConsultarConvite() {
  return useMutation({
    mutationFn: (token: string) =>
      api<ConviteConsultado>('/convites/consultar', { method: 'POST', body: JSON.stringify({ token }) }),
  });
}

export function useAceitarConvite() {
  return useMutation({
    mutationFn: (dados: { token: string; senha: string; nome?: string; telefone?: string }) =>
      api<RespostaSessao>('/convites/aceitar', { method: 'POST', body: JSON.stringify(dados) }),
  });
}
