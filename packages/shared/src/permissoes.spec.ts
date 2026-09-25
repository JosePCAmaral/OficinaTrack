import { PerfilUsuario } from './enums.js';
import { PERMISSOES, PERMISSOES_POR_PERFIL, temPermissao } from './permissoes.js';

describe('permissões por perfil', () => {
  it('todo perfil tem entrada no mapa', () => {
    for (const perfil of PerfilUsuario.options) expect(PERMISSOES_POR_PERFIL[perfil]).toBeDefined();
  });
  it('DONO tem todas', () => {
    for (const p of PERMISSOES) expect(temPermissao('DONO', p)).toBe(true);
  });
  it('FUNCIONARIO opera mas não gerencia equipe nem oficina', () => {
    expect(temPermissao('FUNCIONARIO', 'OS_GERENCIAR')).toBe(true);
    expect(temPermissao('FUNCIONARIO', 'EQUIPE_GERENCIAR')).toBe(false);
    expect(temPermissao('FUNCIONARIO', 'OFICINA_EDITAR')).toBe(false);
  });
});
