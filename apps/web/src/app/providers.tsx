import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 10_000 } } }),
  );
  return (
    <QueryClientProvider client={cliente}>
      {children}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
