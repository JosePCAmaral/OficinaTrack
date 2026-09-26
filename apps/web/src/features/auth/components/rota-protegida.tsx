import type { Permissao } from '@oficinatrack/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../contexto/use-auth';

export function RotaProtegida({ permissao, children }: { permissao?: Permissao; children: ReactNode }) {
  const { estado, tem } = useAuth();
  const location = useLocation();

  if (estado === 'carregando') {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (estado === 'anonimo') {
    return <Navigate to="/entrar" replace state={{ de: location.pathname }} />;
  }

  if (permissao && !tem(permissao)) {
    return <Navigate to="/painel" replace />;
  }

  return <>{children}</>;
}
