import { zodResolver } from '@hookform/resolvers/zod';
import { alterarVeiculoSchema, type AlterarVeiculo, type FichaVeiculo } from '@oficinatrack/shared';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CampoPlaca } from '@/features/os/components/campo-placa';
import { ErroApi } from '@/lib/api';
import { useAlterarVeiculo } from '../api/use-alterar-veiculo';

type AlterarVeiculoEntrada = z.input<typeof alterarVeiculoSchema>;

function valoresIniciais(veiculo: FichaVeiculo): AlterarVeiculoEntrada {
  return {
    placa: veiculo.placa,
    marca: veiculo.marca ?? '',
    modelo: veiculo.modelo ?? '',
    cor: veiculo.cor ?? '',
    chassi: veiculo.chassi ?? '',
    anoModelo: veiculo.anoModelo !== null ? String(veiculo.anoModelo) : '',
    kmAtual: veiculo.kmAtual !== null ? String(veiculo.kmAtual) : '',
  } as AlterarVeiculoEntrada;
}

type EditarVeiculoProps = {
  veiculo: FichaVeiculo;
  aberto: boolean;
  onFechar: () => void;
};

/** Sheet de edição do veículo: placa, marca, modelo, cor, chassi, ano e km. */
export function EditarVeiculo({ veiculo, aberto, onFechar }: EditarVeiculoProps) {
  const alterarVeiculo = useAlterarVeiculo(veiculo.id);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AlterarVeiculoEntrada>({
    resolver: zodResolver(alterarVeiculoSchema),
    defaultValues: valoresIniciais(veiculo),
  });

  useEffect(() => {
    if (aberto) reset(valoresIniciais(veiculo));
  }, [aberto, veiculo, reset]);

  async function aoEnviar(valores: AlterarVeiculoEntrada) {
    try {
      await alterarVeiculo.mutateAsync(valores as unknown as AlterarVeiculo);
      onFechar();
    } catch (erro) {
      if (erro instanceof ErroApi && erro.code === 'PLACA_JA_CADASTRADA') {
        setError('placa', { message: erro.message });
      }
    }
  }

  const erroGeral =
    alterarVeiculo.isError && alterarVeiculo.error instanceof ErroApi && alterarVeiculo.error.code !== 'PLACA_JA_CADASTRADA'
      ? alterarVeiculo.error.message
      : null;

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90vh] gap-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar veículo</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4 px-4">
          {erroGeral && (
            <Alert variant="destructive">
              <AlertDescription>{erroGeral}</AlertDescription>
            </Alert>
          )}

          <Controller
            control={control}
            name="placa"
            render={({ field }) => (
              <CampoPlaca
                id="editar-veiculo-placa"
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.placa?.message}
              />
            )}
          />

          <CampoFormulario id="editar-veiculo-marca" label="Marca" error={errors.marca?.message} registro={register('marca')} />
          <CampoFormulario id="editar-veiculo-modelo" label="Modelo" error={errors.modelo?.message} registro={register('modelo')} />
          <CampoFormulario id="editar-veiculo-cor" label="Cor" error={errors.cor?.message} registro={register('cor')} />
          <CampoFormulario id="editar-veiculo-chassi" label="Chassi" error={errors.chassi?.message} registro={register('chassi')} />
          <CampoFormulario
            id="editar-veiculo-ano"
            label="Ano"
            error={errors.anoModelo?.message}
            registro={register('anoModelo')}
          />
          <CampoFormulario
            id="editar-veiculo-km"
            label="Km atual"
            error={errors.kmAtual?.message}
            registro={register('kmAtual')}
          />

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" className="h-11" disabled={alterarVeiculo.isPending}>
              {alterarVeiculo.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
