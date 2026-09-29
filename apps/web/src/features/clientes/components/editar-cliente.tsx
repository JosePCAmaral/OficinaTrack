import { zodResolver } from '@hookform/resolvers/zod';
import { alterarClienteSchema, type AlterarCliente, type FichaCliente } from '@oficinatrack/shared';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CampoTelefone, formatarTelefoneExibicao } from '@/features/os/components/campo-telefone';
import { ErroApi } from '@/lib/api';
import { useAlterarCliente } from '../api/use-alterar-cliente';

const OBSERVACOES_MAX = 2000;

type AlterarClienteEntrada = z.input<typeof alterarClienteSchema>;

function valoresIniciais(cliente: FichaCliente): AlterarClienteEntrada {
  return {
    nome: cliente.nome ?? '',
    telefone: formatarTelefoneExibicao(cliente.telefone),
    email: cliente.email ?? '',
    documento: cliente.documento ?? '',
    observacoes: cliente.observacoes ?? '',
  } as AlterarClienteEntrada;
}

type EditarClienteProps = {
  cliente: FichaCliente;
  aberto: boolean;
  onFechar: () => void;
};

/** Sheet de edição do cliente: nome, WhatsApp, e-mail, documento e observações internas. */
export function EditarCliente({ cliente, aberto, onFechar }: EditarClienteProps) {
  const alterarCliente = useAlterarCliente(cliente.id);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AlterarClienteEntrada>({
    resolver: zodResolver(alterarClienteSchema),
    defaultValues: valoresIniciais(cliente),
  });

  useEffect(() => {
    if (aberto) reset(valoresIniciais(cliente));
  }, [aberto, cliente, reset]);

  async function aoEnviar(valores: AlterarClienteEntrada) {
    try {
      await alterarCliente.mutateAsync(valores as unknown as AlterarCliente);
      onFechar();
    } catch (erro) {
      if (erro instanceof ErroApi && erro.code === 'TELEFONE_JA_CADASTRADO') {
        setError('telefone', { message: erro.message });
      }
    }
  }

  const erroGeral =
    alterarCliente.isError && alterarCliente.error instanceof ErroApi && alterarCliente.error.code !== 'TELEFONE_JA_CADASTRADO'
      ? alterarCliente.error.message
      : null;

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90vh] gap-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar cliente</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4 px-4">
          {erroGeral && (
            <Alert variant="destructive">
              <AlertDescription>{erroGeral}</AlertDescription>
            </Alert>
          )}

          <CampoFormulario id="editar-cliente-nome" label="Nome" error={errors.nome?.message} registro={register('nome')} />

          <Controller
            control={control}
            name="telefone"
            render={({ field }) => (
              <CampoTelefone
                id="editar-cliente-telefone"
                label="WhatsApp"
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors.telefone?.message}
              />
            )}
          />

          <CampoFormulario
            id="editar-cliente-email"
            label="E-mail"
            type="email"
            error={errors.email?.message}
            registro={register('email')}
          />

          <CampoFormulario
            id="editar-cliente-documento"
            label="CPF/CNPJ"
            error={errors.documento?.message}
            registro={register('documento')}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-cliente-observacoes">Observações · Só a oficina vê</Label>
            <Textarea id="editar-cliente-observacoes" maxLength={OBSERVACOES_MAX} {...register('observacoes')} />
            {errors.observacoes && (
              <p role="alert" className="text-sm text-destructive">
                {errors.observacoes.message}
              </p>
            )}
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" className="h-11" disabled={alterarCliente.isPending}>
              {alterarCliente.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
