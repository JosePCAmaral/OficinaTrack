import { zodResolver } from '@hookform/resolvers/zod';
import { alterarOsSchema, type AlterarOs, type AlterarOsEntrada, type DetalheOS } from '@oficinatrack/shared';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { usePermissao } from '@/features/auth/hooks/use-permissao';
import { useEquipe } from '@/features/equipe/api/use-equipe';
import { ErroApi } from '@/lib/api';
import { useAlterarOs } from '../api/use-alterar-os';

const QUEIXA_MAX = 1000;
const DIAGNOSTICO_MAX = 2000;

function valoresIniciais(os: DetalheOS): AlterarOsEntrada {
  return {
    relatoCliente: os.relatoCliente,
    diagnostico: os.diagnostico ?? '',
    kmEntrada: os.kmEntrada !== null ? String(os.kmEntrada) : '',
    responsavelId: os.responsavel?.id ?? '',
    previsaoEntrega: os.previsaoEntrega ?? '',
  } as AlterarOsEntrada;
}

type EditarOsProps = {
  os: DetalheOS;
  aberto: boolean;
  onFechar: () => void;
};

/** Sheet de edição: queixa, diagnóstico, km, responsável e previsão. Responsável segue o mesmo
 *  padrão da abertura de OS (Tarefa 7): lista da equipe ativa só para quem tem `EQUIPE_GERENCIAR`.
 *  O responsável atual sempre aparece como opção (mesmo inativo ou sendo colega de um FUNCIONARIO),
 *  e só os campos alterados vão no PATCH, para não sobrescrever a edição simultânea de um colega. */
export function EditarOS({ os, aberto, onFechar }: EditarOsProps) {
  const { usuario } = useAuth();
  const podeGerenciarEquipe = usePermissao('EQUIPE_GERENCIAR');
  const equipe = useEquipe({ enabled: podeGerenciarEquipe && aberto });
  const alterarOs = useAlterarOs(os.id);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<AlterarOsEntrada, unknown, AlterarOs>({
    resolver: zodResolver(alterarOsSchema),
    defaultValues: valoresIniciais(os),
  });

  // Ao abrir: valores da OS. Se a OS mudar com o sheet aberto (refetch), atualiza só o que o usuário
  // ainda não mexeu.
  const jaAberto = useRef(false);
  useEffect(() => {
    if (!aberto) {
      jaAberto.current = false;
      return;
    }
    reset(valoresIniciais(os), { keepDirtyValues: jaAberto.current });
    jaAberto.current = true;
  }, [aberto, os, reset]);

  async function aoEnviar(valores: AlterarOs) {
    const alterados = Object.fromEntries(
      Object.entries(valores).filter(([campo]) => dirtyFields[campo as keyof AlterarOsEntrada]),
    ) as AlterarOs;
    if (Object.keys(alterados).length === 0) {
      onFechar();
      return;
    }
    try {
      await alterarOs.mutateAsync(alterados);
      onFechar();
    } catch (erro) {
      if (erro instanceof ErroApi && erro.code === 'RESPONSAVEL_INVALIDO') {
        setError('responsavelId', { message: erro.message });
      }
    }
  }

  const membrosAtivos = (equipe.data ?? []).filter((m) => m.ativo);
  const responsavelAtual = os.responsavel;
  // DONO/gerente: o responsável atual entra como opção extra se não estiver entre os ativos
  // (desativado depois de assumir a OS); "(inativo)" só depois que a lista chegou.
  const responsavelForaDaLista =
    podeGerenciarEquipe && responsavelAtual && !membrosAtivos.some((m) => m.id === responsavelAtual.id)
      ? { id: responsavelAtual.id, nome: equipe.data ? `${responsavelAtual.nome} (inativo)` : responsavelAtual.nome }
      : null;
  // FUNCIONARIO editando a OS de um colega: mostra o colega, e não "Eu".
  const colegaResponsavel =
    !podeGerenciarEquipe && responsavelAtual && responsavelAtual.id !== usuario?.id ? responsavelAtual : null;
  const erroGeral =
    alterarOs.isError && alterarOs.error instanceof ErroApi && alterarOs.error.code !== 'RESPONSAVEL_INVALIDO'
      ? alterarOs.error.message
      : null;

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90vh] gap-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar OS</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4 px-4">
          {erroGeral && (
            <Alert variant="destructive">
              <AlertDescription>{erroGeral}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-os-queixa">Queixa do cliente</Label>
            <Textarea id="editar-os-queixa" maxLength={QUEIXA_MAX} {...register('relatoCliente')} />
            {errors.relatoCliente && (
              <p role="alert" className="text-sm text-destructive">
                {errors.relatoCliente.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-os-diagnostico">Diagnóstico</Label>
            <Textarea id="editar-os-diagnostico" maxLength={DIAGNOSTICO_MAX} {...register('diagnostico')} />
            {errors.diagnostico && (
              <p role="alert" className="text-sm text-destructive">
                {errors.diagnostico.message}
              </p>
            )}
          </div>

          <CampoFormulario id="editar-os-km" label="Km de entrada" registro={register('kmEntrada')} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-os-responsavel">Responsável</Label>
            {/* Select nativo, como na abertura de OS: no celular abre o seletor do sistema. */}
            {/* Controlado (Controller): as opções da equipe chegam depois do reset e o select precisa
                continuar mostrando o valor do formulário. */}
            <Controller
              control={control}
              name="responsavelId"
              render={({ field }) => (
                <select
                  id="editar-os-responsavel"
                  className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                  name={field.name}
                  ref={field.ref}
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                >
                  {podeGerenciarEquipe ? (
                    <>
                      <option value="">Ninguém</option>
                      {responsavelForaDaLista && (
                        <option value={responsavelForaDaLista.id}>{responsavelForaDaLista.nome}</option>
                      )}
                      {membrosAtivos.map((membro) => (
                        <option key={membro.id} value={membro.id}>
                          {membro.nome}
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value={usuario?.id ?? ''}>Eu</option>
                      {colegaResponsavel && <option value={colegaResponsavel.id}>{colegaResponsavel.nome}</option>}
                      <option value="">Ninguém</option>
                    </>
                  )}
                </select>
              )}
            />
            {errors.responsavelId && (
              <p role="alert" className="text-sm text-destructive">
                {errors.responsavelId.message}
              </p>
            )}
          </div>

          <CampoFormulario id="editar-os-previsao" label="Previsão de entrega" type="date" registro={register('previsaoEntrega')} />

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" className="h-11" disabled={alterarOs.isPending}>
              {alterarOs.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
