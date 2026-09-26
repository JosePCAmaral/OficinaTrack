import { useContext } from 'react';
import { ContextoAuth, type ValorAuth } from './auth-provider';

export function useAuth(): ValorAuth {
  const valor = useContext(ContextoAuth);
  if (!valor) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return valor;
}
