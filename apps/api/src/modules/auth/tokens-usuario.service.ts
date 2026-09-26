import { Injectable } from '@nestjs/common';
import { tokenInvalido } from '../../common/erros/erros-auth.js';
import { gerarToken, hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { Prisma, type TipoTokenUsuario } from '../../generated/prisma/client.js';
import { ehConflitoDeTransacao } from '../../prisma/conflito-transacao.js';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const VALIDADE_MS: Record<TipoTokenUsuario, number> = {
  CONFIRMAR_EMAIL: 24 * 60 * 60 * 1000,
  REDEFINIR_SENHA: 60 * 60 * 1000,
};

/** Limite por destinatário (independe do IP): no máximo 3 links do mesmo tipo por hora (auditoria #3). */
export const MAX_LINKS_POR_HORA = 3;
const JANELA_LINKS_MS = 60 * 60 * 1000;
const TENTATIVAS_CONFLITO = 5;

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

  /**
   * Como `criar`, mas devolve `null` (sem criar nada) se o usuário já recebeu `MAX_LINKS_POR_HORA`
   * links deste tipo na última hora. Contagem e criação numa transação serializável: pedidos
   * simultâneos não furam o limite. Num conflito de serialização, tenta de novo (a cada rodada
   * pelo menos uma transação concorrente grava, então a recontagem vê o que ela gravou).
   * Chamar dentro do contexto da oficina do usuário.
   */
  async criarDentroDoLimite(usuario: { id: string; oficinaId: string }, tipo: TipoTokenUsuario): Promise<string | null> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.prisma.db.$transaction(
          async (tx) => {
            const recentes = await tx.tokenUsuario.count({
              where: { usuarioId: usuario.id, tipo, criadoEm: { gt: new Date(Date.now() - JANELA_LINKS_MS) } },
            });
            return recentes >= MAX_LINKS_POR_HORA ? null : this.criar(tx, usuario, tipo);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (erro) {
        // esgotadas as tentativas, fica sem link: nunca fura o limite
        if (!ehConflitoDeTransacao(erro)) throw erro;
        if (tentativa >= TENTATIVAS_CONFLITO) return null;
      }
    }
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
