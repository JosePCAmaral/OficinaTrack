import { StatusApi } from '@/features/saude/components/status-api';

export function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">OficinaTrack</h1>
      <StatusApi />
    </main>
  );
}
