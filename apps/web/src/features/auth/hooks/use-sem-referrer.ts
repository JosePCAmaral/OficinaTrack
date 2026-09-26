import { useEffect } from 'react';

/** Link de e-mail: evita que um proxy de referrer vaze o token para terceiros. */
export function useSemReferrer(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}
