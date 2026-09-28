import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { RotaProtegida } from '@/features/auth/components/rota-protegida';
import { CadastroPage } from '@/features/auth/pages/cadastro';
import { ConfirmarEmail } from '@/features/auth/pages/confirmar-email';
import { Convite } from '@/features/auth/pages/convite';
import { Entrar } from '@/features/auth/pages/entrar';
import { EsqueciSenha } from '@/features/auth/pages/esqueci-senha';
import { RedefinirSenha } from '@/features/auth/pages/redefinir-senha';
import { VerifiqueSeuEmail } from '@/features/auth/pages/verifique-seu-email';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { MinhaConta } from '@/features/conta/pages/minha-conta';
import { Equipe } from '@/features/equipe/pages/equipe';
import { AbrirOs } from '@/features/os/pages/abrir-os';
import { DetalheOs } from '@/features/os/pages/detalhe-os';
import { Oficina } from '@/features/oficina/pages/oficina';
import { LayoutPainel } from '@/features/painel/layout-painel';
import { BuscaEmBreve } from '@/features/painel/pages/busca-em-breve';
import { InicioPainel } from '@/features/painel/pages/inicio-painel';
import { ErroRota } from './erro-rota';
import { PaginaNaoEncontrada } from './pagina-nao-encontrada';

function Raiz() {
  const { estado } = useAuth();
  if (estado === 'carregando') {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  return <Navigate to={estado === 'autenticado' ? '/painel' : '/entrar'} replace />;
}

export const router = createBrowserRouter([
  {
    // Rota "raiz" sem path: só existe para dar um `errorElement` a toda a árvore, para um erro
    // inesperado (ex.: exceção ao renderizar) nunca cair na tela crua do React Router.
    element: <Outlet />,
    errorElement: <ErroRota />,
    children: [
      { path: '/', element: <Raiz /> },
      { path: '/entrar', element: <Entrar /> },
      { path: '/cadastro', element: <CadastroPage /> },
      { path: '/verifique-seu-email', element: <VerifiqueSeuEmail /> },
      { path: '/confirmar-email', element: <ConfirmarEmail /> },
      { path: '/esqueci-senha', element: <EsqueciSenha /> },
      { path: '/redefinir-senha', element: <RedefinirSenha /> },
      { path: '/convite', element: <Convite /> },
      {
        path: '/painel',
        element: (
          <RotaProtegida>
            <LayoutPainel />
          </RotaProtegida>
        ),
        errorElement: <ErroRota />,
        children: [
          { index: true, element: <InicioPainel /> },
          {
            path: 'busca',
            element: <BuscaEmBreve />,
          },
          {
            path: 'os/nova',
            element: (
              <RotaProtegida permissao="OS_GERENCIAR">
                <AbrirOs />
              </RotaProtegida>
            ),
          },
          {
            path: 'os/:id',
            element: (
              <RotaProtegida permissao="OS_GERENCIAR">
                <DetalheOs />
              </RotaProtegida>
            ),
          },
          {
            path: 'equipe',
            element: (
              <RotaProtegida permissao="EQUIPE_GERENCIAR">
                <Equipe />
              </RotaProtegida>
            ),
          },
          {
            path: 'oficina',
            element: (
              <RotaProtegida permissao="OFICINA_EDITAR">
                <Oficina />
              </RotaProtegida>
            ),
          },
          { path: 'conta', element: <MinhaConta /> },
        ],
      },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
]);
