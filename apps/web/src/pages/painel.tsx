import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/contexto/use-auth';

export function Painel() {
  const { usuario, sair } = useAuth();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="font-display text-2xl uppercase tracking-wide">Painel</h1>
      <p>Olá, {usuario?.nome}.</p>
      <Button className="h-11 self-start" onClick={() => void sair()}>
        Sair
      </Button>
    </main>
  );
}
