import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { temPermissao, type ConviteCriado, type ConvitePendente, type PerfilUsuario } from '@oficinatrack/shared';
import { tokenInvalido } from '../../common/erros/erros-auth.js';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { hashSenha } from '../../common/seguranca/senhas.js';
import { gerarToken, hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Env } from '../../config/env.js';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';
import { EnvioEmail } from '../notificacoes/envio-email.js';
import { modelosEmail } from '../notificacoes/modelos-email.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import {
  USUARIO_CREDENCIAIS_ALTERADAS,
  USUARIO_DESATIVADO,
  type UsuarioCredenciaisAlteradas,
  type UsuarioDesativado,
} from './eventos.js';
import { UsuariosService } from './usuarios.service.js';

const VALIDADE_CONVITE_MS = 72 * 60 * 60 * 1000;
/** Reenvios por convite: acima disso, cancelar e convidar de novo (anti-spam, auditoria #2). */
export const MAX_REENVIOS = 3;
const CAMPOS = { id: true, nome: true, email: true, telefone: true, perfil: true, expiraEm: true, criadoEm: true } as const;

type ConviteRegistro = { id: string; nome: string; email: string; telefone: string | null; perfil: PerfilUsuario; expiraEm: Date; criadoEm: Date };

const paraPendente = (c: ConviteRegistro): ConvitePendente => ({
  id: c.id,
  nome: c.nome,
  email: c.email,
  telefone: c.telefone,
  perfil: c.perfil,
  expiraEm: c.expiraEm.toISOString(),
  criadoEm: c.criadoEm.toISOString(),
});

@Injectable()
export class ConvitesService {
  private readonly logger = new Logger(ConvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly config: ConfigService<Env, true>,
    private readonly email: EnvioEmail,
    private readonly oficinas: OficinasService,
    private readonly usuarios: UsuariosService,
  ) {}

  async criar(dados: { nome: string; email: string; telefone?: string; perfil: PerfilUsuario }, criadoPor: { id: string; oficinaId: string }): Promise<ConviteCriado> {
    // sem tenant: e-mail é único no sistema inteiro (a conta pode estar em outra oficina)
    if (await this.tenant.executarSemTenant(() => this.usuarios.emailEmUso(dados.email))) {
      throw new ErroNegocio(409, 'EMAIL_JA_CADASTRADO', 'Este e-mail já tem uma conta no OficinaTrack');
    }
    // um convite pendente por e-mail na oficina: o novo substitui o antigo
    await this.prisma.db.convite.deleteMany({ where: { email: dados.email, usadoEm: null } });
    const { token, hash } = gerarToken();
    const convite = await this.prisma.db.convite.create({
      data: {
        oficinaId: criadoPor.oficinaId,
        criadoPorId: criadoPor.id,
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone ?? null,
        perfil: dados.perfil,
        tokenHash: hash,
        expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS),
      },
      select: CAMPOS,
    });
    return this.enviar(convite, token);
  }

  async listarPendentes(): Promise<ConvitePendente[]> {
    const lista = await this.prisma.db.convite.findMany({ where: { usadoEm: null, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: 'desc' }, select: CAMPOS });
    return lista.map(paraPendente);
  }

  async reenviar(id: string): Promise<ConviteCriado> {
    const { token, hash } = gerarToken();
    // atômico: dois reenvios simultâneos não passam do limite
    const marcado = await this.prisma.db.convite.updateMany({
      where: { id, usadoEm: null, reenvios: { lt: MAX_REENVIOS } },
      data: { tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS), reenvios: { increment: 1 } },
    });
    if (marcado.count !== 1) {
      if ((await this.prisma.db.convite.count({ where: { id, usadoEm: null } })) === 0) throw new NotFoundException();
      throw new ErroNegocio(429, 'MUITAS_TENTATIVAS', 'Limite de reenvios deste convite atingido. Cancele e convide de novo');
    }
    const convite = await this.prisma.db.convite.findUniqueOrThrow({ where: { id }, select: CAMPOS });
    return this.enviar(convite, token);
  }

  async cancelar(id: string): Promise<void> {
    await this.prisma.db.convite.delete({ where: { id, usadoEm: null } });
  }

  async consultar(token: string): Promise<{ nomeOficina: string; nome: string; email: string; telefone: string | null }> {
    const convite = await this.buscarValido(token);
    return this.tenant.executarComo(convite.oficinaId, async () => {
      const oficina = await this.oficinas.buscarAtual();
      return { nomeOficina: oficina.nome, nome: convite.nome, email: convite.email, telefone: convite.telefone };
    });
  }

  async aceitar({ token, senha, nome, telefone }: { token: string; senha: string; nome?: string; telefone?: string }): Promise<{ id: string; oficinaId: string; perfil: PerfilUsuario }> {
    const convite = await this.buscarValido(token);
    const senhaHash = await hashSenha(senha);
    const telefoneFinal = telefone ?? convite.telefone ?? null;
    // sem tenant: telefone e e-mail são únicos no sistema inteiro
    if (telefoneFinal && (await this.tenant.executarSemTenant(() => this.usuarios.telefoneEmUso(telefoneFinal)))) {
      throw new ErroNegocio(409, 'TELEFONE_JA_CADASTRADO', 'Este telefone já está em outra conta');
    }
    return this.tenant.executarComo(convite.oficinaId, () =>
      this.prisma.db.$transaction(async (tx) => {
        // quem convidou ainda precisa poder convidar: um DONO desativado ou rebaixado não volta pela porta dos fundos.
        // trava a linha do criador até o commit: uma desativação/rebaixamento simultâneo espera o aceite
        // terminar (ou o aceite espera a desativação e então a vê).
        const [criador] = await tx.$queryRaw<{ ativo: boolean; perfil: PerfilUsuario }[]>`
          SELECT "ativo", "perfil" FROM "Usuario"
          WHERE "id" = ${convite.criadoPorId} AND "oficinaId" = ${convite.oficinaId}
          FOR UPDATE`;
        if (!criador?.ativo || !temPermissao(criador.perfil, 'EQUIPE_GERENCIAR') || (convite.perfil === 'DONO' && criador.perfil !== 'DONO')) {
          throw tokenInvalido();
        }
        // reconfere hash e validade na marcação: um reenvio ou a expiração entre a leitura e aqui invalidam o link antigo
        const marcado = await tx.convite.updateMany({
          where: { id: convite.id, tokenHash: hashToken(token), usadoEm: null, expiraEm: { gt: new Date() } },
          data: { usadoEm: new Date() },
        });
        if (marcado.count !== 1) throw tokenInvalido();
        return tx.usuario.create({
          data: {
            oficinaId: convite.oficinaId,
            nome: nome ?? convite.nome,
            email: convite.email,
            telefone: telefoneFinal,
            senhaHash,
            perfil: convite.perfil,
            emailConfirmadoEm: new Date(),
          },
          select: { id: true, oficinaId: true, perfil: true },
        });
      }),
    );
  }

  /** Desativado: os convites pendentes que ele criou deixam de valer. */
  @OnEvent(USUARIO_DESATIVADO, { async: true, promisify: true })
  async aoDesativarUsuario({ oficinaId, usuarioId }: UsuarioDesativado): Promise<void> {
    await this.apagarPendentesCriadosPor(oficinaId, usuarioId);
  }

  /** Rebaixado ou com a senha redefinida (conta possivelmente invadida): idem. */
  @OnEvent(USUARIO_CREDENCIAIS_ALTERADAS, { async: true, promisify: true })
  async aoAlterarCredenciais({ oficinaId, usuarioId }: UsuarioCredenciaisAlteradas): Promise<void> {
    await this.apagarPendentesCriadosPor(oficinaId, usuarioId);
  }

  private async apagarPendentesCriadosPor(oficinaId: string, usuarioId: string): Promise<void> {
    await this.tenant.executarComo(oficinaId, () => this.apagarPendentesDe(usuarioId));
  }

  /** Chamar dentro do contexto da oficina (ou com o `tx` dela). */
  async apagarPendentesDe(usuarioId: string, db: Db | Tx = this.prisma.db): Promise<number> {
    const { count } = await db.convite.deleteMany({ where: { criadoPorId: usuarioId, usadoEm: null } });
    return count;
  }

  private async buscarValido(token: string) {
    // sem tenant: o link chega só com o token; a oficina vem do convite achado pelo hash
    const convite = await this.tenant.executarSemTenant(() => this.prisma.db.convite.findUnique({ where: { tokenHash: hashToken(token) } }));
    if (!convite || convite.usadoEm || convite.expiraEm.getTime() <= Date.now()) throw tokenInvalido();
    return convite;
  }

  private async enviar(convite: ConviteRegistro, token: string): Promise<ConviteCriado> {
    const link = `${this.config.get('URL_APP', { infer: true })}/convite#${token}`;
    const oficina = await this.oficinas.buscarAtual();
    try {
      await this.email.enviar({ para: convite.email, ...modelosEmail.convite({ nomeOficina: oficina.nome, nomeConvidado: convite.nome, link }) });
    } catch (erro) {
      this.logger.error(`Falha ao enviar e-mail de convite: ${(erro as Error).name}`);
    }
    return { convite: paraPendente(convite), link };
  }
}
