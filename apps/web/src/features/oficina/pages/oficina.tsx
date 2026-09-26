import { zodResolver } from '@hookform/resolvers/zod';
import { oficinaDadosSchema, UFS, type DadosOficinaEntrada } from '@oficinatrack/shared';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { ErroApi } from '@/lib/api';
import { useAtualizarOficina, useOficina } from '../api/use-oficina';

export function Oficina() {
  const { recarregar } = useAuth();
  const oficina = useOficina();
  const atualizar = useAtualizarOficina();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DadosOficinaEntrada>({ resolver: zodResolver(oficinaDadosSchema) });

  useEffect(() => {
    if (!oficina.data) return;
    reset({
      nome: oficina.data.nome,
      telefone: oficina.data.telefone,
      endereco: oficina.data.endereco ?? '',
      cidade: oficina.data.cidade ?? '',
      uf: (oficina.data.uf ?? undefined) as DadosOficinaEntrada['uf'],
      documento: oficina.data.documento ?? '',
    });
  }, [oficina.data, reset]);

  async function aoSalvar(dados: DadosOficinaEntrada) {
    setMensagem(null);
    setErroGeral(null);
    try {
      await atualizar.mutateAsync(dados);
      await recarregar();
      setMensagem('Dados salvos');
    } catch (erro) {
      setErroGeral(erro instanceof ErroApi ? erro.message : 'Não foi possível completar a ação. Tente de novo.');
    }
  }

  if (oficina.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (oficina.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex w-full items-center justify-between gap-3">
          Não foi possível carregar os dados da oficina.
          <Button type="button" variant="outline" className="h-11" onClick={() => void oficina.refetch()}>
            Tentar de novo
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(aoSalvar)} noValidate className="flex flex-col gap-4">
      <h1 className="font-display text-2xl uppercase tracking-wide">Oficina</h1>
      {mensagem && (
        <Alert>
          <AlertDescription>{mensagem}</AlertDescription>
        </Alert>
      )}
      {erroGeral && (
        <Alert variant="destructive">
          <AlertDescription>{erroGeral}</AlertDescription>
        </Alert>
      )}
      <CampoFormulario id="oficina-nome" label="Nome da oficina" error={errors.nome?.message} registro={register('nome')} />
      <CampoFormulario
        id="oficina-telefone"
        label="WhatsApp da oficina"
        error={errors.telefone?.message}
        registro={register('telefone')}
        autoComplete="tel"
      />
      <CampoFormulario id="oficina-cidade" label="Cidade" error={errors.cidade?.message} registro={register('cidade')} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="oficina-uf">UF</Label>
        <Controller
          control={control}
          name="uf"
          render={({ field }) => (
            <Select value={(field.value as string | undefined) ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="oficina-uf" className="h-11 w-full" aria-invalid={!!errors.uf}>
                <SelectValue placeholder="Selecione a UF" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <CampoFormulario id="oficina-endereco" label="Endereço" error={errors.endereco?.message} registro={register('endereco')} />
      <CampoFormulario
        id="oficina-documento"
        label="CPF/CNPJ (opcional)"
        error={errors.documento?.message}
        registro={register('documento')}
      />
      <Button type="submit" className="h-11 self-start" disabled={atualizar.isPending}>
        {atualizar.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}
