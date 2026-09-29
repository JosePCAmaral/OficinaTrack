import { buscaSchema, type ResultadoBusca } from '@oficinatrack/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Só chama a API com um termo válido pelo schema (2-100 caracteres); termo curto não gera requisição. */
export function useBusca(q: string) {
  const termoValido = buscaSchema.safeParse({ q }).success;
  return useQuery({
    queryKey: ['busca', q],
    queryFn: () => api<ResultadoBusca>(`/busca?q=${encodeURIComponent(q)}`),
    enabled: termoValido,
  });
}
