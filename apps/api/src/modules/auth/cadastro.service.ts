import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cadastro } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { tokenInvalido } from '../../common/erros/erros-auth.js';
import { hashSenha } from '../../common/seguranca/senhas.js';
import { Prisma } from '../../generated/prisma/client.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnvioEmail } from '../notificacoes/envio-email.js';
import { modelosEmail } from '../notificacoes/modelos-email.js';
import { SegundoPlano } from '../notificacoes/segundo-plano.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { CodigosPilotoService } from './codigos-piloto.service.js';
import { SessoesService } from './sessoes.service.js';
import { TokensUsuarioService } from './tokens-usuario.service.js';

const emailJaCadastrado = () => new ErroNegocio(409, 'EMAIL_JA_CADASTRADO', 'Este e-mail já tem uma conta. Entre ou recupere a senha');
const telefoneJaCadastrado = () => new ErroNegocio(409, 'TELEFONE_JA_CADASTRADO', 'Este telefone já está em outra conta');

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
    private readonly segundoPlano: SegundoPlano,
  ) {}

  async cadastrar(dados: Cadastro): Promise<void> {
    const senhaHash = await hashSenha(dados.dono.senha);
    const exigeCodigo = this.config.get('CADASTRO_EXIGE_CODIGO', { infer: true });
    const { telefone } = dados.dono;
    let criado: { usuario: { id: string; oficinaId: string; nome: string; email: string }; token: string };
    try {
      // sem tenant: a oficina ainda não existe; tudo numa transação (código, oficina, dono, token)
      criado = await this.tenant.executarSemTenant(() =>
        this.prisma.db.$transaction(async (tx) => {
          const oficina = await this.oficinas.criar(tx, dados.oficina);
          // o código é conferido antes do e-mail: sem código válido, ninguém descobre se um e-mail tem conta
          if (exigeCodigo) await this.codigos.consumir(tx, dados.codigoPiloto, oficina.id);
          if (await this.usuarios.emailEmUso(dados.dono.email, tx)) throw emailJaCadastrado();
          if (telefone && (await this.usuarios.telefoneEmUso(telefone, tx))) throw telefoneJaCadastrado();
          const usuario = await this.usuarios.criarDono(tx, { oficinaId: oficina.id, nome: dados.dono.nome, email: dados.dono.email, telefone, senhaHash });
          const token = await this.tokens.criar(tx, usuario, 'CONFIRMAR_EMAIL');
          return { usuario, token };
        }),
      );
    } catch (erro) {
      // corrida: outro cadastro/aceite gravou o mesmo e-mail ou telefone entre a checagem e o insert
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') throw await this.conflitoDeUnicidade(dados.dono.email, telefone);
      throw erro;
    }
    await this.enviarConfirmacao(criado.usuario, criado.token);
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

  /**
   * Resposta idêntica exista ou não a conta: depois da busca, token e e-mail rodam em segundo
   * plano (auditoria #11). No máximo `MAX_LINKS_POR_HORA` links por destinatário (auditoria #3).
   */
  async reenviarConfirmacao(email: string): Promise<void> {
    // sem tenant: a busca é pelo e-mail, único no sistema, antes de saber a oficina
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(email));
    if (!usuario || usuario.emailConfirmadoEm || !usuario.ativo) return;
    const { id, oficinaId, nome, email: para } = usuario;
    this.segundoPlano.executar('Falha ao reenviar confirmação', async () => {
      const token = await this.tenant.executarComo(oficinaId, () => this.tokens.criarDentroDoLimite({ id, oficinaId }, 'CONFIRMAR_EMAIL'));
      if (token) await this.enviarConfirmacao({ nome, email: para }, token);
    });
  }

  /** Qual campo único colidiu, conferido de novo depois do P2002 (sem depender do formato do `meta`). */
  private async conflitoDeUnicidade(email: string, telefone: string | undefined): Promise<ErroNegocio> {
    // sem tenant: e-mail e telefone são únicos no sistema inteiro
    return this.tenant.executarSemTenant(async () => {
      if (await this.usuarios.emailEmUso(email)) return emailJaCadastrado();
      if (telefone && (await this.usuarios.telefoneEmUso(telefone))) return telefoneJaCadastrado();
      return new ErroNegocio(409, 'CONFLITO', 'Registro já existe');
    });
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
