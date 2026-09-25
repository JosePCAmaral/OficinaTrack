import { Injectable } from '@nestjs/common';
import { normalizarEmail, normalizarTelefone, PERMISSOES_POR_PERFIL, type Login, type RespostaSessao, type UsuarioEu } from '@oficinatrack/shared';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { verificarSenha } from '../../common/seguranca/senhas.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { naoAutenticado } from './autenticacao.guard.js';
import { LimiteTentativasService } from './limite-tentativas.service.js';
import { SessoesService, type Sessao } from './sessoes.service.js';

const credenciaisInvalidas = () => new ErroNegocio(401, 'CREDENCIAIS_INVALIDAS', 'E-mail/telefone ou senha inválidos');

/** E-mail normalizado ou telefone em E.164; o que não for nenhum dos dois vira texto normalizado (não acha ninguém). */
export function normalizarIdentificador(identificador: string): string {
  if (identificador.includes('@')) return normalizarEmail(identificador);
  return normalizarTelefone(identificador) ?? identificador.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly tenant: TenantContext,
    private readonly usuarios: UsuariosService,
    private readonly oficinas: OficinasService,
    private readonly sessoes: SessoesService,
    private readonly limites: LimiteTentativasService,
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
}
