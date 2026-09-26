import type { DadosOficina, UsuarioEu } from '@oficinatrack/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizarPaginaAuth as renderizar } from '@/test/renderizar-auth';
import { Oficina } from './oficina';

const dono: UsuarioEu = {
  id: 'u-dono',
  nome: 'Zé Mecânico',
  email: 'ze@oficina.com',
  perfil: 'DONO',
  permissoes: ['OFICINA_EDITAR'],
  oficina: { id: 'o1', nome: 'Oficina do Zé' },
};

const dadosAtuais: DadosOficina = {
  id: 'o1',
  nome: 'Oficina do Zé',
  telefone: '+5543999998888',
  endereco: null,
  cidade: 'Ribeirão do Pinhal',
  uf: 'PR',
  documento: null,
};

function mockFetch(dadosSalvos: DadosOficina) {
  return vi.fn<(u: string, i?: RequestInit) => Promise<Response>>().mockImplementation(async (url, init) => {
    const metodo = init?.method ?? 'GET';
    if (url.endsWith('/oficinas/atual') && metodo === 'GET') {
      return new Response(JSON.stringify(dadosAtuais), { status: 200 });
    }
    if (url.endsWith('/oficinas/atual') && metodo === 'PATCH') {
      return new Response(JSON.stringify(dadosSalvos), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
}

describe('Oficina', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('salva os dados e recarrega a sessão para atualizar a barra', async () => {
    const dadosSalvos: DadosOficina = { ...dadosAtuais, nome: 'Oficina do Zé Ltda' };
    vi.stubGlobal('fetch', mockFetch(dadosSalvos));
    const recarregar = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    renderizar(<Oficina />, { auth: { estado: 'autenticado', usuario: dono, tem: () => true, recarregar } });

    const campoNome = await screen.findByLabelText('Nome da oficina');
    expect(campoNome).toHaveValue('Oficina do Zé');

    await usuario.clear(campoNome);
    await usuario.type(campoNome, 'Oficina do Zé Ltda');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Dados salvos')).toBeInTheDocument();
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});
