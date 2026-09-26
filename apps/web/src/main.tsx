import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './features/auth/contexto/auth-provider';
import { Providers } from './app/providers';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </Providers>
  </StrictMode>,
);
