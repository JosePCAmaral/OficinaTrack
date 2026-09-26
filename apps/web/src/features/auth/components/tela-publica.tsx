import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TelaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center font-display text-2xl font-bold uppercase tracking-wide text-primary">
          OficinaTrack
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase tracking-wide">{titulo}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
