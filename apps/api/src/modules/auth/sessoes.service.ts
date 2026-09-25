import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import type { PerfilUsuario } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { gerarToken, hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { PrismaService, type Db } from '../../prisma/prisma.service.js';
import { USUARIO_DESATIVADO, type UsuarioDesativado } from '../usuarios/eventos.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { PayloadAcesso } from './autenticacao.guard.js';

const DURACAO_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
/** Duas abas renovando juntas: o perdedor recebe 401 sem derrubar a família. */
const TOLERANCIA_CONCORRENCIA_MS = 10_000;

export type Sessao = { accessToken: string; refreshToken: string; refreshExpiraEm: Date; familiaId: string };

const sessaoInvalida = () => new ErroNegocio(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre de novo');

/**
 * Mesmo corpo HTTP de `SESSAO_INVALIDA`, mas para o caso "perdi a corrida de rotação para outra
 * aba/requisição da mesma família" — não é reuso malicioso nem sessão realmente inválida, então
 * o chamador (controller) não deve limpar o cookie de refresh: fazer isso apagaria, numa corrida
 * real, o cookie novo que a requisição vencedora acabou de gravar no navegador (Review Focus 1).
 */
export class SessaoConcorrenteError extends ErroNegocio {
  constructor() {
    super(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre de novo');
  }
}
const sessaoConcorrente = () => new SessaoConcorrenteError();

@Injectable()
export class SessoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly jwt: JwtService,
    private readonly usuarios: UsuariosService,
  ) {}

  /** Chamar dentro do contexto da oficina do usuário. */
  async criar(usuario: { id: string; oficinaId: string; perfil: PerfilUsuario }, familiaId: string = randomUUID()): Promise<Sessao> {
    const { token, refreshExpiraEm } = await this.criarRegistro(this.prisma.db, usuario, familiaId);
    const payload: PayloadAcesso = { sub: usuario.id, oficinaId: usuario.oficinaId, perfil: usuario.perfil, fam: familiaId };
    return { accessToken: await this.jwt.signAsync(payload), refreshToken: token, refreshExpiraEm, familiaId };
  }

  async renovar(refreshToken: string): Promise<Sessao & { usuarioId: string; oficinaId: string }> {
    // sem tenant: o refresh chega só com o cookie; a oficina vem do registro achado pelo hash
    const registro = await this.tenant.executarSemTenant(() =>
      this.prisma.db.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } }),
    );
    if (!registro) throw sessaoInvalida();

    return this.tenant.executarComo(registro.oficinaId, async () => {
      const agora = Date.now();
      if (registro.substituidoEm) {
        if (agora - registro.substituidoEm.getTime() > TOLERANCIA_CONCORRENCIA_MS) {
          await this.revogarFamilia(registro.familiaId);
          throw sessaoInvalida();
        }
        // dentro da tolerância: outra aba já rotacionou este token antes desta requisição chegar
        throw sessaoConcorrente();
      }
      if (registro.revogadoEm || registro.expiraEm.getTime() <= agora) throw sessaoInvalida();

      const usuario = await this.usuarios.buscarAtivo(registro.usuarioId);
      if (!usuario) {
        await this.revogarFamilia(registro.familiaId);
        throw sessaoInvalida();
      }

      // marcar a rotação + criar o novo token numa transação: fecha a corrida entre a checagem de
      // "família revogada" (detecção de reuso feita por outra requisição) e a criação do substituto.
      const { token, refreshExpiraEm } = await this.prisma.db.$transaction(async (tx) => {
        const marcado = await tx.refreshToken.updateMany({
          where: { id: registro.id, substituidoEm: null, revogadoEm: null },
          data: { substituidoEm: new Date() },
        });
        // perdeu a corrida de rotação para outra requisição da mesma família (duas abas renovando juntas)
        if (marcado.count !== 1) throw sessaoConcorrente();
        // a família foi revogada entre a leitura inicial e a marcação (ex.: reuso detectado em paralelo)
        const familiaRevogada = await tx.refreshToken.count({ where: { familiaId: registro.familiaId, revogadoEm: { not: null } } });
        if (familiaRevogada > 0) throw sessaoInvalida();
        return this.criarRegistro(tx, usuario, registro.familiaId);
      });

      const payload: PayloadAcesso = { sub: usuario.id, oficinaId: usuario.oficinaId, perfil: usuario.perfil, fam: registro.familiaId };
      const accessToken = await this.jwt.signAsync(payload);
      return { accessToken, refreshToken: token, refreshExpiraEm, familiaId: registro.familiaId, usuarioId: usuario.id, oficinaId: usuario.oficinaId };
    });
  }

  async revogar(refreshToken: string): Promise<void> {
    // sem tenant: logout chega só com o cookie
    const registro = await this.tenant.executarSemTenant(() =>
      this.prisma.db.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, select: { oficinaId: true, familiaId: true } }),
    );
    if (!registro) return;
    await this.tenant.executarComo(registro.oficinaId, () => this.revogarFamilia(registro.familiaId));
  }

  /** Chamar dentro do contexto da oficina. */
  async revogarTodasDoUsuario(usuarioId: string, excetoFamilia?: string): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({
      where: { usuarioId, revogadoEm: null, ...(excetoFamilia ? { familiaId: { not: excetoFamilia } } : {}) },
      data: { revogadoEm: new Date() },
    });
  }

  @OnEvent(USUARIO_DESATIVADO, { async: true, promisify: true })
  async aoDesativarUsuario({ oficinaId, usuarioId }: UsuarioDesativado): Promise<void> {
    await this.tenant.executarComo(oficinaId, () => this.revogarTodasDoUsuario(usuarioId));
  }

  private async revogarFamilia(familiaId: string): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({ where: { familiaId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  }

  /** Só grava a linha do refresh token; usado tanto fora de transação (login) quanto dentro (rotação). */
  private async criarRegistro(db: Db, usuario: { id: string; oficinaId: string }, familiaId: string): Promise<{ token: string; refreshExpiraEm: Date }> {
    const { token, hash } = gerarToken();
    const refreshExpiraEm = new Date(Date.now() + DURACAO_REFRESH_MS);
    await db.refreshToken.create({
      data: { oficinaId: usuario.oficinaId, usuarioId: usuario.id, familiaId, tokenHash: hash, expiraEm: refreshExpiraEm },
    });
    return { token, refreshExpiraEm };
  }
}
