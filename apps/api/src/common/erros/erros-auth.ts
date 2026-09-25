import { ErroNegocio } from './erro-negocio.js';

/** Mesmo erro para token inexistente, expirado, usado ou de outro tipo: não revela qual. */
export const tokenInvalido = () => new ErroNegocio(400, 'TOKEN_INVALIDO', 'Link inválido ou expirado. Peça um novo');
