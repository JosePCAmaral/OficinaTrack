import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { alterarUsuarioSchema, type MembroEquipe, type PerfilUsuario } from '@oficinatrack/shared';
import { ZodValidationPipe } from '../../common/validacao/zod-validation.pipe.js';
import { ExigePermissao, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ExigePermissao('EQUIPE_GERENCIAR')
  async listar(): Promise<MembroEquipe[]> {
    return (await this.usuarios.listar()).map(paraMembro);
  }

  @Patch(':id')
  @ExigePermissao('EQUIPE_GERENCIAR')
  async alterar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(alterarUsuarioSchema)) dados: { perfil?: PerfilUsuario; ativo?: boolean },
    @UsuarioAtual() ator: UsuarioAutenticado,
  ): Promise<MembroEquipe> {
    return paraMembro(await this.usuarios.alterar(id, dados, ator));
  }
}

const paraMembro = (u: { id: string; nome: string; email: string; telefone: string | null; perfil: PerfilUsuario; ativo: boolean; criadoEm: Date }): MembroEquipe => ({
  id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil, ativo: u.ativo, criadoEm: u.criadoEm.toISOString(),
});
