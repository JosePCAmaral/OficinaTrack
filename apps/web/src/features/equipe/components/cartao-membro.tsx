import type { MembroEquipe } from '@oficinatrack/shared';
import { MoreVertical } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ErroApi } from '@/lib/api';
import { useAlterarUsuario } from '../api/use-equipe';

function tratarErro(erro: unknown) {
  toast.error(erro instanceof ErroApi ? erro.message : 'Não foi possível completar a ação. Tente de novo.');
}

export function CartaoMembro({ membro, souEu }: { membro: MembroEquipe; souEu: boolean }) {
  const alterar = useAlterarUsuario();
  const [confirmarDesativar, setConfirmarDesativar] = useState(false);

  async function alternarPerfil() {
    try {
      await alterar.mutateAsync({ id: membro.id, dados: { perfil: membro.perfil === 'DONO' ? 'FUNCIONARIO' : 'DONO' } });
    } catch (erro) {
      tratarErro(erro);
    }
  }

  async function alternarAtivo(ativo: boolean) {
    try {
      await alterar.mutateAsync({ id: membro.id, dados: { ativo } });
    } catch (erro) {
      tratarErro(erro);
    } finally {
      setConfirmarDesativar(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{membro.nome}</p>
        <p className="truncate text-sm text-muted-foreground">{membro.email}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={membro.perfil === 'DONO' ? 'default' : 'secondary'}>{membro.perfil === 'DONO' ? 'Dono' : 'Funcionário'}</Badge>
          {!membro.ativo && (
            <Badge variant="outline" className="text-muted-foreground">
              Inativo
            </Badge>
          )}
        </div>
      </div>

      {!souEu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Ações de ${membro.nome}`}>
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void alternarPerfil()}>
              {membro.perfil === 'DONO' ? 'Tornar funcionário' : 'Tornar dono'}
            </DropdownMenuItem>
            {membro.ativo ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmarDesativar(true)}>
                Desativar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => void alternarAtivo(true)}>Reativar</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={confirmarDesativar} onOpenChange={setConfirmarDesativar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {membro.nome}?</AlertDialogTitle>
            <AlertDialogDescription>{membro.nome} perde o acesso na hora.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => void alternarAtivo(false)}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
