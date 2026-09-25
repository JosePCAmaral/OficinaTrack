import { Injectable } from '@nestjs/common';
import type { PerfilUsuario } from '@oficinatrack/shared';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

export const CAMPOS_PUBLICOS = {
  id: true, oficinaId: true, nome: true, email: true, telefone: true, perfil: true, ativo: true, emailConfirmadoEm: true, criadoEm: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

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
}
