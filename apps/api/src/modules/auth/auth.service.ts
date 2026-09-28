import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { normalizarEmail, normalizarTelefone, PERMISSOES_POR_PERFIL, type Login, type PerfilUsuario, type RespostaSessao, type UsuarioEu } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { hashSenha, verificarSenha } from '../../common/seguranca/senhas.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnvioEmail } from '../notificacoes/envio-email.js';
import { modelosEmail } from '../notificacoes/modelos-email.js';
import { SegundoPlano } from '../notificacoes/segundo-plano.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { ConvitesService } from '../usuarios/convites.service.js';
import { USUARIO_CREDENCIAIS_ALTERADAS, type UsuarioCredenciaisAlteradas } from '../usuarios/eventos.js';
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

/**
 * Chave do bloqueio de login: a conta, quando existe (e-mail e telefone somam no mesmo contador);
 * senão, o identificador normalizado (quem chuta contas inexistentes também é barrado).
 */
export const chaveBloqueio = (usuarioId: string | undefined, identificadorNormalizado: string) =>
  usuarioId ? `conta:${usuarioId}` : `identificador:${identificadorNormalizado}`;

@Injectable()
export class AuthService {
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
    private readonly eventos: EventEmitter2,
    private readonly segundoPlano: SegundoPlano,
    private readonly convites: ConvitesService,
  ) {}

  async login({ identificador, senha }: Login): Promise<Sessao & { usuarioId: string; oficinaId: string }> {
    const normalizado = normalizarIdentificador(identificador);
    // sem tenant: o login acontece antes de saber a oficina; e-mail e telefone são únicos no sistema
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(normalizado));
    const chave = chaveBloqueio(usuario?.id, normalizado);
    this.limites.verificar(chave);
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

  /** Chamado pelo aceite de convite: cria a primeira sessão do usuário recém-criado. */
  async criarSessaoConvite(usuario: { id: string; oficinaId: string; perfil: PerfilUsuario }): Promise<Sessao & { usuarioId: string; oficinaId: string }> {
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

  /**
   * Resposta idêntica exista ou não a conta: depois da busca, gerar o token e enviar o e-mail
   * rodam em segundo plano, então o tempo de resposta não revela nada (auditoria #11).
   * No máximo `MAX_LINKS_POR_HORA` e-mails por destinatário (auditoria #3).
   */
  async esqueciSenha(email: string): Promise<void> {
    // sem tenant: a busca é pelo e-mail, único no sistema, antes de saber a oficina
    const usuario = await this.tenant.executarSemTenant(() => this.usuarios.buscarParaLogin(email));
    if (!usuario || !usuario.ativo) return;
    const { id, oficinaId, nome, email: para } = usuario;
    this.segundoPlano.executar('Falha ao enviar e-mail de redefinição', async () => {
      const token = await this.tenant.executarComo(oficinaId, () => this.tokens.criarDentroDoLimite({ id, oficinaId }, 'REDEFINIR_SENHA'));
      if (!token) return; // limite por destinatário: silencioso, a resposta já foi a mesma
      const link = `${this.config.get('URL_APP', { infer: true })}/redefinir-senha#${token}`;
      await this.email.enviar({ para, ...modelosEmail.redefinirSenha({ nome, link }) });
    });
  }

  /**
   * Recuperação de conta: senha nova, e-mail confirmado (o link provou a posse), todas as sessões
   * revogadas, access tokens já emitidos cortados (`sessaoValidaDesde`) e os convites pendentes que
   * o usuário criou apagados (a conta pode ter sido invadida) — tudo na mesma transação.
   */
  async redefinirSenha(token: string, senha: string): Promise<void> {
    const { usuarioId, oficinaId } = await this.tokens.consumir(token, 'REDEFINIR_SENHA');
    const senhaHash = await hashSenha(senha);
    await this.tenant.executarComo(oficinaId, async () => {
      await this.prisma.db.$transaction(async (tx) => {
        await this.usuarios.atualizarSenha(usuarioId, senhaHash, tx);
        await this.usuarios.marcarEmailConfirmado(usuarioId, tx);
        await this.sessoes.revogarTodasDoUsuario(usuarioId, undefined, tx);
        await this.convites.apagarPendentesDe(usuarioId, tx);
      });
      // o evento continua sendo emitido: outros ouvintes (auditoria, etc.) dependem dele
      await this.eventos.emitAsync(USUARIO_CREDENCIAIS_ALTERADAS, { oficinaId, usuarioId, motivo: 'SENHA_REDEFINIDA' } satisfies UsuarioCredenciaisAlteradas);
    });
    // quem provou a posse do e-mail volta a poder entrar mesmo com a conta bloqueada por tentativas
    this.limites.limpar(chaveBloqueio(usuarioId, ''));
  }

  /**
   * Dentro da requisição autenticada (contexto já definido pelo guard). Derruba os outros aparelhos
   * e corta os access tokens emitidos até agora; este aparelho renova pelo refresh (família mantida).
   */
  async trocarSenha(usuario: UsuarioAutenticado, senhaAtual: string, novaSenha: string): Promise<void> {
    const atual = await this.usuarios.buscarSenhaHash(usuario.id);
    if (!(await verificarSenha(atual?.senhaHash, senhaAtual))) {
      throw new ErroNegocio(400, 'SENHA_ATUAL_INCORRETA', 'A senha atual não confere');
    }
    const senhaHash = await hashSenha(novaSenha);
    await this.prisma.db.$transaction(async (tx) => {
      await this.usuarios.atualizarSenha(usuario.id, senhaHash, tx);
      await this.sessoes.revogarTodasDoUsuario(usuario.id, usuario.familiaId, tx);
    });
  }
}
