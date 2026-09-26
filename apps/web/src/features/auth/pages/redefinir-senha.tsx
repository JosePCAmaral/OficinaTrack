import { zodResolver } from '@hookform/resolvers/zod';
import { senhaSchema } from '@oficinatrack/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErroApi } from '@/lib/api';
import { useRedefinirSenha } from '../api/use-redefinir-senha';
import { TelaPublica } from '../components/tela-publica';
import { useSemReferrer } from '../hooks/use-sem-referrer';
import { useTokenHash } from '../hooks/use-token-hash';

const formSchema = z
  .object({ senha: senhaSchema, repetirSenha: z.string().min(1, { error: 'Repita a senha' }) })
  .refine((d) => d.senha === d.repetirSenha, { error: 'As senhas não são iguais', path: ['repetirSenha'] });
type Dados = z.input<typeof formSchema>;

export function RedefinirSenha() {
  useSemReferrer();
  const token = useTokenHash();
  const mutacao = useRedefinirSenha();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; tokenInvalido?: boolean } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Dados>({ resolver: zodResolver(formSchema) });

  async function aoEnviar(dados: Dados) {
    setErro(null);
    try {
      const resposta = await mutacao.mutateAsync({ token, senha: dados.senha });
      setMensagem(resposta.mensagem);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro({ mensagem: e.message, tokenInvalido: e.code === 'TOKEN_INVALIDO' });
        return;
      }
      setErro({ mensagem: 'Não foi possível completar a ação. Tente de novo.' });
    }
  }

  if (mensagem) {
    return (
      <TelaPublica titulo="Redefinir senha">
        <Alert>
          <AlertDescription>{mensagem}</AlertDescription>
        </Alert>
        <Button asChild className="h-11">
          <Link to="/entrar">Ir para Entrar</Link>
        </Button>
      </TelaPublica>
    );
  }

  return (
    <TelaPublica titulo="Redefinir senha">
      <form onSubmit={handleSubmit(aoEnviar)} className="flex flex-col gap-4" noValidate>
        {erro && (
          <Alert variant="destructive">
            <AlertDescription>
              {erro.mensagem}
              {erro.tokenInvalido && (
                <>
                  {' '}
                  <Link to="/esqueci-senha" className="underline underline-offset-4">
                    Pedir um novo link
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
        <CampoFormulario
          id="senha"
          label="Nova senha"
          type="password"
          error={errors.senha?.message}
          registro={register('senha')}
          autoComplete="new-password"
        />
        <CampoFormulario
          id="repetirSenha"
          label="Repetir senha"
          type="password"
          error={errors.repetirSenha?.message}
          registro={register('repetirSenha')}
          autoComplete="new-password"
        />
        <Button type="submit" className="h-11" disabled={mutacao.isPending || !token}>
          {mutacao.isPending ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </TelaPublica>
  );
}
