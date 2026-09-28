import { useParams } from 'react-router';

/** Placeholder mínimo: a tela completa da OS (cabeçalho, abas, eventos) é a Tarefa 8. */
export function OsDetalhe() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-2xl uppercase tracking-wide">OS</h1>
      <p className="text-muted-foreground">OS {id} criada. A tela completa chega em breve.</p>
    </div>
  );
}
