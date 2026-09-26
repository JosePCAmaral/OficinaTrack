import { Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { usePermissao } from '@/features/auth/hooks/use-permissao';
import { cn } from '@/lib/utils';

const itemClasse = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground',
  );

function ItensMenu({ aoNavegar }: { aoNavegar?: () => void }) {
  const podeEditarOficina = usePermissao('OFICINA_EDITAR');
  const podeGerenciarEquipe = usePermissao('EQUIPE_GERENCIAR');
  const { sair } = useAuth();

  return (
    <nav className="flex flex-col gap-1">
      <NavLink to="/painel" end onClick={aoNavegar} className={itemClasse}>
        Pátio
      </NavLink>
      {podeGerenciarEquipe && (
        <NavLink to="/painel/equipe" onClick={aoNavegar} className={itemClasse}>
          Equipe
        </NavLink>
      )}
      {podeEditarOficina && (
        <NavLink to="/painel/oficina" onClick={aoNavegar} className={itemClasse}>
          Oficina
        </NavLink>
      )}
      <NavLink to="/painel/conta" onClick={aoNavegar} className={itemClasse}>
        Minha conta
      </NavLink>
      <button
        type="button"
        className="flex h-11 items-center rounded-md px-3 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        onClick={() => {
          aoNavegar?.();
          void sair();
        }}
      >
        Sair
      </button>
    </nav>
  );
}

function NomeOficina({ className }: { className?: string }) {
  const { usuario } = useAuth();
  return <p className={cn('truncate font-display text-lg uppercase tracking-wide text-primary', className)}>{usuario?.oficina.nome}</p>;
}

export function LayoutPainel({ children }: { children?: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="hidden shrink-0 flex-col gap-4 border-r bg-card p-4 lg:flex lg:w-64">
        <NomeOficina />
        <ItensMenu />
      </aside>

      <div className="flex flex-1 flex-col">
        <header
          className="fixed inset-x-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden"
          style={{ top: 'env(safe-area-inset-top)' }}
        >
          <NomeOficina className="pr-2" />
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4">
                <ItensMenu aoNavegar={() => setMenuAberto(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-8 lg:pt-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
