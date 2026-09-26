import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type Login } from '@oficinatrack/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErroApi } from '@/lib/api';
import { useLogin } from '../api/use-login';
import { TelaPublica } from '../components/tela-publica';
import { useAuth } from '../contexto/use-auth';

export function Entrar() {
  const { estado, entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const estadoDe = (location.state as { de?: string } | null)?.de;
  const mutacao = useLogin();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Login>({ resolver: zodResolver(loginSchema) });

  if (estado === 'autenticado') {
    return <Navigate to="/painel" replace />;
  }

  async function aoEnviar(dados: Login) {
    setErroGeral(null);
    try {
      const resposta = await mutacao.mutateAsync(dados);
      entrar(resposta);
      navigate(estadoDe ?? '/painel', { replace: true });
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.code === 'EMAIL_NAO_CONFIRMADO') {
          navigate('/verifique-seu-email', { state: { email: dados.identificador } });
          return;
        }
        setErroGeral(erro.message);
        return;
      }
      setErroGeral('Não foi possível completar a ação. Tente de novo.');
    }
  }

  return (
    <TelaPublica titulo="Entrar">
      <form onSubmit={handleSubmit(aoEnviar)} className="flex flex-col gap-4" noValidate>
        {erroGeral && (
          <Alert variant="destructive">
            <AlertDescription>{erroGeral}</AlertDescription>
          </Alert>
        )}
        <CampoFormulario
          id="identificador"
          label="E-mail ou telefone"
          error={errors.identificador?.message}
          registro={register('identificador')}
          autoComplete="username"
        />
        <CampoFormulario
          id="senha"
          label="Senha"
          type="password"
          error={errors.senha?.message}
          registro={register('senha')}
          autoComplete="current-password"
        />
        <Button type="submit" className="h-11" disabled={mutacao.isPending}>
          {mutacao.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
        <div className="flex flex-col items-center gap-2 text-sm">
          <Link to="/esqueci-senha" className="text-primary underline-offset-4 hover:underline">
            Esqueci a senha
          </Link>
          <Link to="/cadastro" className="text-primary underline-offset-4 hover:underline">
            Criar conta da oficina
          </Link>
        </div>
      </form>
    </TelaPublica>
  );
}
