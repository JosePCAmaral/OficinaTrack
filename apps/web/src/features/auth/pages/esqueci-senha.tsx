import { zodResolver } from '@hookform/resolvers/zod';
import { emailApenasSchema } from '@oficinatrack/shared';
import { useState } from 'react';
import type { z } from 'zod';
import { useForm } from 'react-hook-form';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErroApi } from '@/lib/api';
import { useEsqueciSenha } from '../api/use-esqueci-senha';
import { TelaPublica } from '../components/tela-publica';

type Dados = z.input<typeof emailApenasSchema>;

export function EsqueciSenha() {
  const mutacao = useEsqueciSenha();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Dados>({ resolver: zodResolver(emailApenasSchema) });

  async function aoEnviar(dados: Dados) {
    setMensagem(null);
    setErro(null);
    try {
      const resposta = await mutacao.mutateAsync(dados.email);
      setMensagem(resposta.mensagem);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível completar a ação. Tente de novo.');
    }
  }

  if (mensagem) {
    return (
      <TelaPublica titulo="Esqueci a senha">
        <Alert>
          <AlertDescription>{mensagem}</AlertDescription>
        </Alert>
      </TelaPublica>
    );
  }

  return (
    <TelaPublica titulo="Esqueci a senha">
      <form onSubmit={handleSubmit(aoEnviar)} className="flex flex-col gap-4" noValidate>
        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
        <CampoFormulario
          id="email"
          label="E-mail"
          type="email"
          error={errors.email?.message}
          registro={register('email')}
          autoComplete="email"
        />
        <Button type="submit" className="h-11" disabled={mutacao.isPending}>
          {mutacao.isPending ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>
    </TelaPublica>
  );
}
