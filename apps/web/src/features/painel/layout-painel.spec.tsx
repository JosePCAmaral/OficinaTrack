import type { UsuarioEu } from '@oficinatrack/shared';
import { screen } from '@testing-library/react';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { LayoutPainel } from './layout-painel';

function usuario(perfil: UsuarioEu['perfil'], permissoes: UsuarioEu['permissoes']): UsuarioEu {
  return { id: '1', nome: 'Zé Mecânico', email: 'ze@oficina.com', perfil, permissoes, oficina: { id: 'o1', nome: 'Oficina do Zé' } };
}

describe('LayoutPainel', () => {
  it('FUNCIONARIO não vê Equipe nem Oficina no menu', () => {
    renderizar(<LayoutPainel />, {
      auth: {
        estado: 'autenticado',
        usuario: usuario('FUNCIONARIO', ['OS_GERENCIAR']),
        tem: (p) => (['OS_GERENCIAR'] as string[]).includes(p),
      },
    });

    expect(screen.getAllByText('Pátio').length).toBeGreaterThan(0);
    expect(screen.queryByText('Equipe')).not.toBeInTheDocument();
    expect(screen.queryByText('Oficina')).not.toBeInTheDocument();
    expect(screen.getAllByText('Minha conta').length).toBeGreaterThan(0);
  });

  it('DONO vê Equipe e Oficina no menu', () => {
    renderizar(<LayoutPainel />, {
      auth: {
        estado: 'autenticado',
        usuario: usuario('DONO', ['OFICINA_EDITAR', 'EQUIPE_GERENCIAR']),
        tem: (p) => (['OFICINA_EDITAR', 'EQUIPE_GERENCIAR'] as string[]).includes(p),
      },
    });

    expect(screen.getAllByText('Equipe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Oficina').length).toBeGreaterThan(0);
  });
});
