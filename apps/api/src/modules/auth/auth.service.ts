import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizarEmail, normalizarTelefone, PERMISSOES_POR_PERFIL, type Login, type RespostaSessao, type UsuarioEu } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { hashSenha, verificarSenha } from '../../common/seguranca/senhas.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnvioEmail } from '../notificacoes/envio-email.js';
import { modelosEmail } from '../notificacoes/modelos-email.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { naoAutenticado } from './autenticacao.guard.js';
import type { UsuarioAutenticado } from './decorators.js';
import { LimiteTentativasService } from './limite-tentativas.service.js';
import { SessoesService, type Sessao } from './sessoes.service.js';
import { TokensUsuarioService } from './tokens-usuario.service.js';

const credenciaisInvalidas = () => new ErroNegocio(401, 'CREDENCIAIS_INVALIDAS', 'E-mail/telefone ou senha inválidos');

/** E-mail normalizado ou telefone em E.164; o que não for nenhum dos dois vira texto normalizado (não acha ninguém). */
export function normalizarIdentificador(identificador: string): string {
  if (identificador.includes('@')) return normalizarEmail(identificador);
  return normalizarTelefone(identificador) ?? identificador.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly tenant: TenantContext,
    private readonly usuarios: UsuariosService,
    private readonly oficinas: OficinasService,
    private readonly sessoes: SessoesService,
    private readonly limites: LimiteTentativasService,
    private readonly tokens: TokensUsuarioService,
    private readonly email: EnvioEmail,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  async login({ identificador, senha }: Login): Promise<Sessao & { usuarioId: string; oficinaId: string }> {
    const chave = normalizarIdentificador(identificador);
    this.limites.verificar(chave);
    // sem tenant: o login acontece antes de saber a oficina; e-mail e telefone são únicos no sistema
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(chave));
    const senhaConfere = await verificarSenha(usuario?.senhaHash, senha);
    if (!usuario || !senhaConfere || !usuario.ativo) {
      this.limites.registrarFalha(chave);
      throw credenciaisInvalidas();
    }
    this.limites.limpar(chave);
    if (!usuario.emailConfirmadoEm) throw new ErroNegocio(403, 'EMAIL_NAO_CONFIRMADO', 'Confirme seu e-mail para entrar');
    const sessao = await this.tenant.executarComo(usuario.oficinaId, () => this.sessoes.criar(usuario));
    return { ...sessao, usuarioId: usuario.id, oficinaId: usuario.oficinaId };
  }

  /** Monta a resposta pública de `/auth/login` e `/auth/refresh` a partir da sessão criada. */
  async montarResposta(sessao: Awaited<ReturnType<AuthService['login']>>): Promise<RespostaSessao> {
    const usuario = await this.tenant.executarComo(sessao.oficinaId, () => this.montarEu(sessao.usuarioId));
    return { accessToken: sessao.accessToken, usuario };
  }

  /** Chamar dentro do contexto da oficina do usuário. */
  async montarEu(usuarioId: string): Promise<UsuarioEu> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw naoAutenticado();
    const oficina = await this.oficinas.buscarAtual();
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      permissoes: [...PERMISSOES_POR_PERFIL[usuario.perfil]],
      oficina: { id: oficina.id, nome: oficina.nome },
    };
  }

  /** Resposta idêntica exista ou não a conta; envio sem `await` para o tempo não revelar nada. */
  async esqueciSenha(email: string): Promise<void> {
    // sem tenant: a busca é pelo e-mail, único no sistema, antes de saber a oficina
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(email));
    if (!usuario || !usuario.ativo) return;
    const token = await this.tenant.executarComo(usuario.oficinaId, () => this.tokens.criar(this.prisma.db, usuario, 'REDEFINIR_SENHA'));
    const link = `${this.config.get('URL_APP', { infer: true })}/redefinir-senha#${token}`;
    // sem await: o tempo de resposta não pode revelar se a conta existe
    void this.email
      .enviar({ para: usuario.email, ...modelosEmail.redefinirSenha({ nome: usuario.nome, link }) })
      .catch((erro: Error) => this.logger.error(`Falha ao enviar e-mail de redefinição: ${erro.name}`));
  }

  async redefinirSenha(token: string, senha: string): Promise<void> {
    const { usuarioId, oficinaId } = await this.tokens.consumir(token, 'REDEFINIR_SENHA');
    const senhaHash = await hashSenha(senha);
    await this.tenant.executarComo(oficinaId, async () => {
      await this.usuarios.atualizarSenha(usuarioId, senhaHash);
      await this.usuarios.marcarEmailConfirmado(usuarioId); // o link provou a posse do e-mail
      await this.sessoes.revogarTodasDoUsuario(usuarioId);
    });
  }

  /** Dentro da requisição autenticada (contexto já definido pelo guard). */
  async trocarSenha(usuario: UsuarioAutenticado, senhaAtual: string, novaSenha: string): Promise<void> {
    const atual = await this.usuarios.buscarSenhaHash(usuario.id);
    if (!(await verificarSenha(atual?.senhaHash, senhaAtual))) {
      throw new ErroNegocio(400, 'SENHA_ATUAL_INCORRETA', 'A senha atual não confere');
    }
    await this.usuarios.atualizarSenha(usuario.id, await hashSenha(novaSenha));
    await this.sessoes.revogarTodasDoUsuario(usuario.id, usuario.familiaId);
  }
}
