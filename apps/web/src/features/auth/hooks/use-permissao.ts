import type { Permissao } from '@oficinatrack/shared';
import { useAuth } from '../contexto/use-auth';

export function usePermissao(permissao: Permissao): boolean {
  return useAuth().tem(permissao);
}
