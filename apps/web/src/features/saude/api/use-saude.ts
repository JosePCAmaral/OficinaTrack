import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type Saude = { status: 'ok'; banco: 'ok' };

export function useSaude() {
  return useQuery({ queryKey: ['saude'], queryFn: () => api<Saude>('/saude'), retry: false });
}
