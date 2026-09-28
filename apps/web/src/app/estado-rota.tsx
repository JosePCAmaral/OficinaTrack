import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

/** Tela cheia e amigável para "não encontrado" e "erro inesperado" — nunca a tela crua do React Router. */
export function EstadoRota({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="font-display text-2xl uppercase tracking-wide">{titulo}</h1>
      {descricao && <p className="text-muted-foreground">{descricao}</p>}
      <Button asChild className="h-11">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
