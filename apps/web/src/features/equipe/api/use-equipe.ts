import type { MembroEquipe } from '@oficinatrack/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * `enabled: false` evita a chamada a `/usuarios` para quem não tem `EQUIPE_GERENCIAR` (ex.: seletor
 * de responsável na abertura de OS, que some para FUNCIONARIO sem permissão).
 */
export function useEquipe(opcoes: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ['equipe'], queryFn: () => api<MembroEquipe[]>('/usuarios'), enabled: opcoes.enabled ?? true });
}

export type AlterarUsuarioDados = { perfil?: MembroEquipe['perfil']; ativo?: boolean };

export function useAlterarUsuario() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: AlterarUsuarioDados }) =>
      api<MembroEquipe>(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['equipe'] });
      void cliente.invalidateQueries({ queryKey: ['convites'] });
    },
  });
}
