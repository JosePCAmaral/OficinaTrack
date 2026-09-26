import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { useConvites } from '../api/use-convites';
import { useEquipe } from '../api/use-equipe';
import { CartaoMembro } from '../components/cartao-membro';
import { FormularioConvite } from '../components/formulario-convite';
import { ListaConvites } from '../components/lista-convites';

export function Equipe() {
  const { usuario } = useAuth();
  const [conviteAberto, setConviteAberto] = useState(false);
  const equipe = useEquipe();
  const convites = useConvites();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl uppercase tracking-wide">Equipe</h1>
        {!conviteAberto && (
          <Button className="h-11" onClick={() => setConviteAberto(true)}>
            <UserPlus className="size-4" />
            Convidar
          </Button>
        )}
      </div>

      {conviteAberto && <FormularioConvite onConcluido={() => setConviteAberto(false)} />}

      <section aria-labelledby="titulo-membros" className="flex flex-col gap-3">
        <h2 id="titulo-membros" className="font-display text-lg uppercase tracking-wide text-muted-foreground">
          Membros
        </h2>
        {equipe.isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {equipe.isError && (
          <Alert variant="destructive">
            <AlertDescription className="flex w-full items-center justify-between gap-3">
              Não foi possível carregar a equipe.
              <Button type="button" variant="outline" className="h-11" onClick={() => void equipe.refetch()}>
                Tentar de novo
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {equipe.data &&
          (equipe.data.length <= 1 ? (
            <p className="text-muted-foreground">Só você por aqui. Convide sua equipe.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {equipe.data.map((membro) => (
                <CartaoMembro key={membro.id} membro={membro} souEu={membro.id === usuario?.id} />
              ))}
            </ul>
          ))}
      </section>

      <section aria-labelledby="titulo-convites" className="flex flex-col gap-3">
        <h2 id="titulo-convites" className="font-display text-lg uppercase tracking-wide text-muted-foreground">
          Convites pendentes
        </h2>
        {convites.isLoading && <Skeleton className="h-16 w-full" />}
        {convites.isError && (
          <Alert variant="destructive">
            <AlertDescription className="flex w-full items-center justify-between gap-3">
              Não foi possível carregar os convites.
              <Button type="button" variant="outline" className="h-11" onClick={() => void convites.refetch()}>
                Tentar de novo
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {convites.data &&
          (convites.data.length === 0 ? (
            <p className="text-muted-foreground">Nenhum convite pendente.</p>
          ) : (
            <ListaConvites convites={convites.data} nomeOficina={usuario?.oficina.nome ?? ''} />
          ))}
      </section>
    </div>
  );
}
