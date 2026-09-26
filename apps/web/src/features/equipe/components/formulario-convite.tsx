import { zodResolver } from '@hookform/resolvers/zod';
import { conviteSchema, type ConviteCriado, type ConviteEntrada } from '@oficinatrack/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { ErroApi } from '@/lib/api';
import { useConvidar } from '../api/use-convites';
import { LinkConvite } from './link-convite';

export function FormularioConvite({ onConcluido }: { onConcluido: () => void }) {
  const { usuario } = useAuth();
  const convidar = useConvidar();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [criado, setCriado] = useState<ConviteCriado | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ConviteEntrada>({ resolver: zodResolver(conviteSchema), defaultValues: { perfil: 'FUNCIONARIO' } });

  async function aoEnviar(dados: ConviteEntrada) {
    setErroGeral(null);
    try {
      setCriado(await convidar.mutateAsync(dados));
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.code === 'EMAIL_JA_CADASTRADO') {
          setError('email', { message: erro.message });
          return;
        }
        setErroGeral(erro.message);
        return;
      }
      setErroGeral('Não foi possível completar a ação. Tente de novo.');
    }
  }

  if (criado) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <p>
          Convite criado para <strong>{criado.convite.nome}</strong>.
        </p>
        <LinkConvite convite={criado} nomeOficina={usuario?.oficina.nome ?? ''} />
        <Button type="button" variant="outline" className="h-11 self-start" onClick={onConcluido}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4 rounded-lg border p-4">
      {erroGeral && (
        <Alert variant="destructive">
          <AlertDescription>{erroGeral}</AlertDescription>
        </Alert>
      )}
      <CampoFormulario id="convite-nome" label="Nome" error={errors.nome?.message} registro={register('nome')} />
      <CampoFormulario
        id="convite-email"
        label="E-mail"
        type="email"
        error={errors.email?.message}
        registro={register('email')}
      />
      <CampoFormulario
        id="convite-telefone"
        label="WhatsApp (opcional)"
        error={errors.telefone?.message}
        registro={register('telefone')}
        autoComplete="tel"
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="convite-perfil">Perfil</Label>
        <Controller
          control={control}
          name="perfil"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="convite-perfil" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                <SelectItem value="DONO">Dono</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-11" disabled={convidar.isPending}>
          {convidar.isPending ? 'Enviando…' : 'Enviar convite'}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onConcluido}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
