import { Injectable } from '@nestjs/common';
import { tokenInvalido } from '../../common/erros/erros-auth.js';
import { gerarToken, hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { TipoTokenUsuario } from '../../generated/prisma/client.js';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const VALIDADE_MS: Record<TipoTokenUsuario, number> = {
  CONFIRMAR_EMAIL: 24 * 60 * 60 * 1000,
  REDEFINIR_SENHA: 60 * 60 * 1000,
};

@Injectable()
export class TokensUsuarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  /** Invalida os tokens anteriores do mesmo tipo e cria um novo. Devolve o token em claro (vai só no e-mail). */
  async criar(db: Db | Tx, usuario: { id: string; oficinaId: string }, tipo: TipoTokenUsuario): Promise<string> {
    await db.tokenUsuario.updateMany({ where: { usuarioId: usuario.id, tipo, usadoEm: null }, data: { usadoEm: new Date() } });
    const { token, hash } = gerarToken();
    await db.tokenUsuario.create({
      data: { oficinaId: usuario.oficinaId, usuarioId: usuario.id, tipo, tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_MS[tipo]) },
    });
    return token;
  }

  /** Mesmo erro para inexistente, expirado, usado ou de outro tipo. */
  async consumir(token: string, tipo: TipoTokenUsuario): Promise<{ usuarioId: string; oficinaId: string }> {
    // sem tenant: o link chega só com o token; a oficina vem do registro achado pelo hash
    const registro = await this.tenant.executarSemTenant(() =>
      this.prisma.db.tokenUsuario.findUnique({ where: { tokenHash: hashToken(token) } }),
    );
    if (!registro || registro.tipo !== tipo || registro.usadoEm || registro.expiraEm.getTime() <= Date.now()) throw tokenInvalido();
    const marcado = await this.tenant.executarComo(registro.oficinaId, () =>
      this.prisma.db.tokenUsuario.updateMany({ where: { id: registro.id, usadoEm: null }, data: { usadoEm: new Date() } }),
    );
    if (marcado.count !== 1) throw tokenInvalido();
    return { usuarioId: registro.usuarioId, oficinaId: registro.oficinaId };
  }
}
