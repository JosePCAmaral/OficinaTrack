import { zodResolver } from '@hookform/resolvers/zod';
import { senhaSchema } from '@oficinatrack/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { ErroApi } from '@/lib/api';
import { useTrocarSenha } from '../api/use-trocar-senha';

const formSchema = z
  .object({
    senhaAtual: z.string().min(1, { error: 'Informe a senha atual' }).max(128),
    novaSenha: senhaSchema,
    repetirSenha: z.string().min(1, { error: 'Repita a nova senha' }),
  })
  .refine((d) => d.senhaAtual !== d.novaSenha, { error: 'A nova senha precisa ser diferente da atual', path: ['novaSenha'] })
  .refine((d) => d.novaSenha === d.repetirSenha, { error: 'As senhas não coincidem', path: ['repetirSenha'] });
type FormSenha = z.input<typeof formSchema>;

export function MinhaConta() {
  const { usuario } = useAuth();
  const trocarSenha = useTrocarSenha();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormSenha>({ resolver: zodResolver(formSchema) });

  async function aoSalvar(dados: FormSenha) {
    setMensagem(null);
    setErroGeral(null);
    try {
      await trocarSenha.mutateAsync({ senhaAtual: dados.senhaAtual, novaSenha: dados.novaSenha });
      setMensagem('Senha alterada. Os outros aparelhos vão precisar entrar de novo.');
      reset({ senhaAtual: '', novaSenha: '', repetirSenha: '' });
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.code === 'SENHA_ATUAL_INCORRETA') {
          setError('senhaAtual', { message: erro.message });
          return;
        }
        setErroGeral(erro.message);
        return;
      }
      setErroGeral('Não foi possível completar a ação. Tente de novo.');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide">Minha conta</h1>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conta-nome">Nome</Label>
            <Input id="conta-nome" value={usuario?.nome ?? ''} readOnly className="h-11" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conta-email">E-mail</Label>
            <Input id="conta-email" value={usuario?.email ?? ''} readOnly className="h-11" />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(aoSalvar)} noValidate className="flex flex-col gap-4">
        <h2 className="font-display text-lg uppercase tracking-wide text-muted-foreground">Trocar senha</h2>
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
        <CampoFormulario
          id="senhaAtual"
          label="Senha atual"
          type="password"
          error={errors.senhaAtual?.message}
          registro={register('senhaAtual')}
          autoComplete="current-password"
        />
        <CampoFormulario
          id="novaSenha"
          label="Nova senha"
          type="password"
          error={errors.novaSenha?.message}
          registro={register('novaSenha')}
          autoComplete="new-password"
        />
        <CampoFormulario
          id="repetirSenha"
          label="Repetir nova senha"
          type="password"
          error={errors.repetirSenha?.message}
          registro={register('repetirSenha')}
          autoComplete="new-password"
        />
        <Button type="submit" className="h-11 self-start" disabled={trocarSenha.isPending}>
          {trocarSenha.isPending ? 'Salvando…' : 'Trocar senha'}
        </Button>
      </form>
    </div>
  );
}
