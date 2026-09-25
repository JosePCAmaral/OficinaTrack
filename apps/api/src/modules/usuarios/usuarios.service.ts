import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PerfilUsuario } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';
import { USUARIO_DESATIVADO, type UsuarioDesativado } from './eventos.js';

export const CAMPOS_PUBLICOS = {
  id: true, oficinaId: true, nome: true, email: true, telefone: true, perfil: true, ativo: true, emailConfirmadoEm: true, criadoEm: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventEmitter2,
  ) {}

  /** Chamar dentro de `executarSemTenant`: e-mail e telefone são únicos no sistema. Único método que devolve `senhaHash`. */
  buscarParaLogin(chave: string) {
    return this.prisma.db.usuario.findUnique({ where: chave.includes('@') ? { email: chave } : { telefone: chave } });
  }

  buscarAtivo(id: string) {
    return this.prisma.db.usuario.findFirst({ where: { id, ativo: true }, select: CAMPOS_PUBLICOS });
  }

  buscarPorId(id: string) {
    return this.prisma.db.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS });
  }

  /** Chamar dentro de `executarSemTenant` quando a checagem precisa ser global (e-mail é único no sistema, não só na oficina). */
  async emailEmUso(email: string, db: Db | Tx = this.prisma.db): Promise<boolean> {
    return (await db.usuario.count({ where: { email } })) > 0;
  }

  /** Chamar dentro de `executarSemTenant` quando a checagem precisa ser global (telefone é único no sistema, não só na oficina). */
  async telefoneEmUso(telefone: string, db: Db | Tx = this.prisma.db): Promise<boolean> {
    return (await db.usuario.count({ where: { telefone } })) > 0;
  }

  criarDono(db: Db | Tx, dados: { oficinaId: string; nome: string; email: string; senhaHash: string }) {
    return db.usuario.create({ data: { ...dados, perfil: 'DONO' as PerfilUsuario }, select: CAMPOS_PUBLICOS });
  }

  marcarEmailConfirmado(id: string) {
    return this.prisma.db.usuario.updateMany({ where: { id, emailConfirmadoEm: null }, data: { emailConfirmadoEm: new Date() } });
  }

  atualizarSenha(id: string, senhaHash: string) {
    return this.prisma.db.usuario.update({ where: { id }, data: { senhaHash }, select: { id: true } });
  }

  buscarSenhaHash(id: string) {
    return this.prisma.db.usuario.findUnique({ where: { id }, select: { senhaHash: true } });
  }

  listar() {
    return this.prisma.db.usuario.findMany({ orderBy: { nome: 'asc' }, select: CAMPOS_PUBLICOS });
  }

  /**
   * Leitura do alvo, contagem de outros DONOs ativos e gravação numa única transação
   * serializável: sem isso, dois DONOs se rebaixando/desativando ao mesmo tempo poderiam
   * passar os dois pela contagem antes de qualquer gravação e deixar a oficina sem DONO
   * ativo (TOCTOU). O Postgres aborta uma das transações concorrentes com P2034; nesse
   * caso tentamos de novo uma vez antes de devolver conflito ao chamador.
   */
  private executarAlteracao(id: string, dados: { perfil?: PerfilUsuario; ativo?: boolean }) {
    return this.prisma.db.$transaction(
      async (tx) => {
        const alvo = await tx.usuario.findUniqueOrThrow({ where: { id }, select: CAMPOS_PUBLICOS });
        const deixaDeSerDonoAtivo = alvo.perfil === 'DONO' && alvo.ativo && (dados.perfil === 'FUNCIONARIO' || dados.ativo === false);
        if (deixaDeSerDonoAtivo) {
          const outros = await tx.usuario.count({ where: { perfil: 'DONO', ativo: true, id: { not: id } } });
          if (outros === 0) throw new ErroNegocio(422, 'ULTIMO_DONO', 'A oficina precisa de pelo menos um dono ativo');
        }
        const atualizado = await tx.usuario.update({ where: { id }, data: dados, select: CAMPOS_PUBLICOS });
        return { atualizado, desativou: alvo.ativo && dados.ativo === false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Na requisição autenticada. Regras: não altera a si mesmo; sempre sobra um DONO ativo. */
  async alterar(id: string, dados: { perfil?: PerfilUsuario; ativo?: boolean }, ator: { id: string; oficinaId: string }) {
    if (id === ator.id) throw new ErroNegocio(422, 'ACAO_NAO_PERMITIDA_EM_SI_MESMO', 'Você não pode alterar o próprio perfil ou se desativar');

    let resultado: Awaited<ReturnType<typeof this.executarAlteracao>>;
    try {
      resultado = await this.executarAlteracao(id, dados);
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== 'P2034') throw erro;
      try {
        resultado = await this.executarAlteracao(id, dados);
      } catch (erroRetentativa) {
        if (erroRetentativa instanceof Prisma.PrismaClientKnownRequestError && erroRetentativa.code === 'P2034') {
          throw new ErroNegocio(409, 'CONFLITO', 'Outra alteração na equipe aconteceu ao mesmo tempo. Tente de novo');
        }
        throw erroRetentativa;
      }
    }

    if (resultado.desativou) {
      await this.eventos.emitAsync(USUARIO_DESATIVADO, { oficinaId: ator.oficinaId, usuarioId: id } satisfies UsuarioDesativado);
    }
    return resultado.atualizado;
  }
}
