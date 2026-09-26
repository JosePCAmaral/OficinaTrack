import type { Request } from 'express';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';

/**
 * Rotas que agem pelo cookie (refresh/logout) ou criam sessão a partir de um link público
 * (confirmar e-mail, aceitar convite) conferem a origem: defesa extra além do SameSite=Strict.
 */
export function exigirOrigem(req: Request, origemPermitida: string): void {
  if (req.headers.origin !== origemPermitida) {
    throw new ErroNegocio(403, 'SEM_PERMISSAO', 'Origem não permitida');
  }
}
