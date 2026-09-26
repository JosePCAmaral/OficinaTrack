import { createBrowserRouter, Navigate } from 'react-router';
import { RotaProtegida } from '@/features/auth/components/rota-protegida';
import { CadastroPage } from '@/features/auth/pages/cadastro';
import { ConfirmarEmail } from '@/features/auth/pages/confirmar-email';
import { Convite } from '@/features/auth/pages/convite';
import { Entrar } from '@/features/auth/pages/entrar';
import { EsqueciSenha } from '@/features/auth/pages/esqueci-senha';
import { RedefinirSenha } from '@/features/auth/pages/redefinir-senha';
import { VerifiqueSeuEmail } from '@/features/auth/pages/verifique-seu-email';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { Painel } from '@/pages/painel';

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
        <Painel />
      </RotaProtegida>
    ),
  },
]);
