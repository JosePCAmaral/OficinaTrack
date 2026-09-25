import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cadastro } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { tokenInvalido } from '../../common/erros/erros-auth.js';
import { hashSenha } from '../../common/seguranca/senhas.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnvioEmail } from '../notificacoes/envio-email.js';
import { modelosEmail } from '../notificacoes/modelos-email.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { CodigosPilotoService } from './codigos-piloto.service.js';
import { SessoesService } from './sessoes.service.js';
import { TokensUsuarioService } from './tokens-usuario.service.js';

@Injectable()
export class CadastroService {
  private readonly logger = new Logger(CadastroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly config: ConfigService<Env, true>,
    private readonly oficinas: OficinasService,
    private readonly usuarios: UsuariosService,
    private readonly codigos: CodigosPilotoService,
    private readonly tokens: TokensUsuarioService,
    private readonly sessoes: SessoesService,
    private readonly email: EnvioEmail,
  ) {}

  async cadastrar(dados: Cadastro): Promise<void> {
    const senhaHash = await hashSenha(dados.dono.senha);
    const exigeCodigo = this.config.get('CADASTRO_EXIGE_CODIGO', { infer: true });
    // sem tenant: a oficina ainda não existe; tudo numa transação (código, oficina, dono, token)
    const { usuario, token } = await this.tenant.executarSemTenant(() =>
      this.prisma.db.$transaction(async (tx) => {
        const oficina = await this.oficinas.criar(tx, dados.oficina);
        // o código é conferido antes do e-mail: sem código válido, ninguém descobre se um e-mail tem conta
        if (exigeCodigo) await this.codigos.consumir(tx, dados.codigoPiloto, oficina.id);
        if (await this.usuarios.emailEmUso(dados.dono.email, tx)) {
          throw new ErroNegocio(409, 'EMAIL_JA_CADASTRADO', 'Este e-mail já tem uma conta. Entre ou recupere a senha');
        }
        const usuario = await this.usuarios.criarDono(tx, { oficinaId: oficina.id, nome: dados.dono.nome, email: dados.dono.email, senhaHash });
        const token = await this.tokens.criar(tx, usuario, 'CONFIRMAR_EMAIL');
        return { usuario, token };
      }),
    );
    await this.enviarConfirmacao(usuario, token);
  }

  async confirmarEmail(token: string) {
    const { usuarioId, oficinaId } = await this.tokens.consumir(token, 'CONFIRMAR_EMAIL');
    return this.tenant.executarComo(oficinaId, async () => {
      await this.usuarios.marcarEmailConfirmado(usuarioId);
      const usuario = await this.usuarios.buscarAtivo(usuarioId);
      if (!usuario) throw tokenInvalido();
      const sessao = await this.sessoes.criar(usuario);
      return { ...sessao, usuarioId: usuario.id, oficinaId };
    });
  }

  /** Resposta idêntica exista ou não a conta; envio sem `await` para o tempo não revelar nada. */
  async reenviarConfirmacao(email: string): Promise<void> {
    // sem tenant: a busca é pelo e-mail, único no sistema, antes de saber a oficina
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(email));
    if (!usuario || usuario.emailConfirmadoEm || !usuario.ativo) return;
    const token = await this.tenant.executarComo(usuario.oficinaId, () => this.tokens.criar(this.prisma.db, usuario, 'CONFIRMAR_EMAIL'));
    void this.enviarConfirmacao(usuario, token);
  }

  private async enviarConfirmacao(usuario: { nome: string; email: string }, token: string): Promise<void> {
    const link = `${this.config.get('URL_APP', { infer: true })}/confirmar-email#${token}`;
    try {
      await this.email.enviar({ para: usuario.email, ...modelosEmail.confirmarEmail({ nome: usuario.nome, link }) });
    } catch (erro) {
      this.logger.error(`Falha ao enviar e-mail de confirmação: ${(erro as Error).name}`);
    }
  }
}
