import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConviteCriado, ConvitePendente, PerfilUsuario } from '@oficinatrack/shared';
import { tokenInvalido } from '../../common/erros/erros-auth.js';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { hashSenha } from '../../common/seguranca/senhas.js';
import { gerarToken, hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnvioEmail } from '../notificacoes/envio-email.js';
import { modelosEmail } from '../notificacoes/modelos-email.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from './usuarios.service.js';

const VALIDADE_CONVITE_MS = 72 * 60 * 60 * 1000;
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
    const convite = await this.prisma.db.convite.update({
      where: { id, usadoEm: null },
      data: { tokenHash: hash, expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS) },
      select: CAMPOS,
    });
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
        const marcado = await tx.convite.updateMany({ where: { id: convite.id, usadoEm: null }, data: { usadoEm: new Date() } });
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
