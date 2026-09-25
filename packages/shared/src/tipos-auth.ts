import type { PerfilUsuario } from './enums.js';
import type { Permissao } from './permissoes.js';

export type UsuarioEu = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  permissoes: Permissao[];
  oficina: { id: string; nome: string };
};
export type RespostaSessao = { accessToken: string; usuario: UsuarioEu };
export type MembroEquipe = {
  id: string; nome: string; email: string; telefone: string | null; perfil: PerfilUsuario; ativo: boolean; criadoEm: string;
};
export type ConvitePendente = { id: string; nome: string; email: string; telefone: string | null; perfil: PerfilUsuario; expiraEm: string; criadoEm: string };
export type ConviteCriado = { convite: ConvitePendente; link: string };
export type DadosOficina = {
  id: string; nome: string; telefone: string; endereco: string | null; cidade: string | null; uf: string | null; documento: string | null;
};
