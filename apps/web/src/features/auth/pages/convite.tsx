import { zodResolver } from '@hookform/resolvers/zod';
import { aceitarConviteSchema } from '@oficinatrack/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErroApi } from '@/lib/api';
import { useAceitarConvite, useConsultarConvite, type ConviteConsultado } from '../api/use-convite';
import { TelaPublica } from '../components/tela-publica';
import { useAuth } from '../contexto/use-auth';
import { useSemReferrer } from '../hooks/use-sem-referrer';
import { useTokenHash } from '../hooks/use-token-hash';

// Mesmo schema do backend, sem o `token` (que vem do hash, não do formulário); `nome` fica
// obrigatório na tela porque o campo é editável e sempre parte pré-preenchido pelo convite.
const formSchema = aceitarConviteSchema.omit({ token: true }).extend({
  nome: z.string().trim().min(2, { error: 'Informe seu nome' }).max(120),
});
type Dados = z.input<typeof formSchema>;

export function Convite() {
  useSemReferrer();
  const token = useTokenHash();
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const consultar = useConsultarConvite();
  const aceitar = useAceitarConvite();
  const [convite, setConvite] = useState<ConviteConsultado | null>(null);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [erroAceite, setErroAceite] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<Dados>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (convite) reset({ nome: convite.nome, telefone: convite.telefone ?? '', senha: '' });
  }, [convite, reset]);

  async function verConvite() {
    setErroConsulta(null);
    try {
      setConvite(await consultar.mutateAsync(token));
    } catch (e) {
      setErroConsulta(e instanceof ErroApi ? e.message : 'Não foi possível completar a ação. Tente de novo.');
    }
  }

  async function aoAceitar(dados: Dados) {
    setErroAceite(null);
    try {
      const resposta = await aceitar.mutateAsync({
        token,
        senha: dados.senha,
        nome: dados.nome,
        telefone: (dados.telefone as string | undefined) || undefined,
      });
      entrar(resposta);
      navigate('/painel', { replace: true });
    } catch (e) {
      if (e instanceof ErroApi) {
        if (e.code === 'TELEFONE_JA_CADASTRADO') {
          setError('telefone', { message: e.message });
          return;
        }
        setErroAceite(e.message);
        return;
      }
      setErroAceite('Não foi possível completar a ação. Tente de novo.');
    }
  }

  if (!convite) {
    return (
      <TelaPublica titulo="Convite">
        <p>Você recebeu um convite</p>
        {erroConsulta && (
          <Alert variant="destructive">
            <AlertDescription>{erroConsulta}</AlertDescription>
          </Alert>
        )}
        <Button type="button" className="h-11" onClick={verConvite} disabled={consultar.isPending || !token}>
          {consultar.isPending ? 'Carregando…' : 'Ver convite'}
        </Button>
      </TelaPublica>
    );
  }

  return (
    <TelaPublica titulo="Convite">
      <p>
        Convite para entrar na oficina <strong>{convite.nomeOficina}</strong>
      </p>
      <form onSubmit={handleSubmit(aoAceitar)} className="flex flex-col gap-4" noValidate>
        {erroAceite && (
          <Alert variant="destructive">
            <AlertDescription>{erroAceite}</AlertDescription>
          </Alert>
        )}
        <CampoFormulario id="nome" label="Nome" error={errors.nome?.message} registro={register('nome')} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={convite.email} readOnly className="h-11" />
        </div>
        <CampoFormulario
          id="telefone"
          label="WhatsApp (opcional)"
          error={errors.telefone?.message}
          registro={register('telefone')}
          autoComplete="tel"
        />
        <CampoFormulario
          id="senha"
          label="Senha"
          type="password"
          error={errors.senha?.message}
          registro={register('senha')}
          autoComplete="new-password"
        />
        <Button type="submit" className="h-11" disabled={aceitar.isPending}>
          {aceitar.isPending ? 'Aceitando…' : 'Aceitar'}
        </Button>
      </form>
    </TelaPublica>
  );
}
