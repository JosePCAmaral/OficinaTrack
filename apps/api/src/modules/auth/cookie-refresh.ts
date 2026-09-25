import type { Response } from 'express';

export const COOKIE_REFRESH = 'ot_refresh';
const OPCOES = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/api/v1/auth' };

export function definirCookieRefresh(res: Response, sessao: { refreshToken: string; refreshExpiraEm: Date }): void {
  res.cookie(COOKIE_REFRESH, sessao.refreshToken, { ...OPCOES, expires: sessao.refreshExpiraEm });
}

export function limparCookieRefresh(res: Response): void {
  res.clearCookie(COOKIE_REFRESH, OPCOES);
}
