import { zodResolver } from '@hookform/resolvers/zod';
import { cadastroSchema, UFS, type Cadastro } from '@oficinatrack/shared';
import { useState } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErroApi } from '@/lib/api';
import { useCadastro } from '../api/use-cadastro';
import { TelaPublica } from '../components/tela-publica';

const cadastroFormSchema = cadastroSchema.extend({
  codigoPiloto: z.string().trim().min(1, { error: 'Informe o código de acesso' }).max(20),
});
type CadastroForm = z.input<typeof cadastroFormSchema>;

type DetalheErro = { campo: string; mensagem: string };

export function CadastroPage() {
  const navigate = useNavigate();
  const mutacao = useCadastro();
  const [erroGeral, setErroGeral] = useState<{ mensagem: string; mostrarLinkEntrar?: boolean } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroFormSchema),
    defaultValues: { oficina: { uf: undefined }, aceiteTermos: undefined },
  });

  async function aoEnviar(dados: CadastroForm) {
    setErroGeral(null);
    try {
      const resposta = await mutacao.mutateAsync(dados as Cadastro);
      navigate('/verifique-seu-email', { state: { email: dados.dono.email, mensagem: resposta.mensagem } });
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.code === 'CODIGO_PILOTO_INVALIDO') {
          setError('codigoPiloto', { message: erro.message });
          return;
        }
        if (erro.code === 'TELEFONE_JA_CADASTRADO') {
          setError('dono.telefone', { message: erro.message });
          return;
        }
        if (erro.code === 'EMAIL_JA_CADASTRADO') {
          setError('dono.email', { message: erro.message });
          setErroGeral({ mensagem: erro.message, mostrarLinkEntrar: true });
          return;
        }
        if (erro.code === 'VALIDACAO_FALHOU' && Array.isArray(erro.details)) {
          for (const detalhe of erro.details as DetalheErro[]) {
            setError(detalhe.campo as FieldPath<CadastroForm>, { message: detalhe.mensagem });
          }
          return;
        }
        setErroGeral({ mensagem: erro.message });
        return;
      }
      setErroGeral({ mensagem: 'Não foi possível completar a ação. Tente de novo.' });
    }
  }

  return (
    <TelaPublica titulo="Criar conta da oficina">
      <form onSubmit={handleSubmit(aoEnviar)} className="flex flex-col gap-5" noValidate>
        {erroGeral && (
          <Alert variant="destructive">
            <AlertDescription>
              {erroGeral.mensagem}
              {erroGeral.mostrarLinkEntrar && (
                <>
                  {' '}
                  <Link to="/entrar" className="underline underline-offset-4">
                    Entrar
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <CampoFormulario
          id="codigoPiloto"
          label="Código de acesso"
          error={errors.codigoPiloto?.message}
          registro={register('codigoPiloto')}
          autoComplete="off"
        />

        <fieldset className="flex flex-col gap-4">
          <legend className="font-display text-base uppercase tracking-wide text-muted-foreground">Oficina</legend>
          <CampoFormulario
            id="oficina-nome"
            label="Nome da oficina"
            error={errors.oficina?.nome?.message}
            registro={register('oficina.nome')}
          />
          <CampoFormulario
            id="oficina-telefone"
            label="WhatsApp da oficina"
            error={errors.oficina?.telefone?.message}
            registro={register('oficina.telefone')}
            autoComplete="tel"
          />
          <CampoFormulario
            id="oficina-cidade"
            label="Cidade"
            error={errors.oficina?.cidade?.message}
            registro={register('oficina.cidade')}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oficina-uf">UF</Label>
            <Controller
              control={control}
              name="oficina.uf"
              render={({ field }) => (
                <Select value={(field.value as string | undefined) ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="oficina-uf" className="h-11 w-full" aria-invalid={!!errors.oficina?.uf}>
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
            {errors.oficina?.uf && (
              <p role="alert" className="text-sm text-destructive">
                {errors.oficina.uf.message}
              </p>
            )}
          </div>
          <CampoFormulario
            id="oficina-endereco"
            label="Endereço"
            error={errors.oficina?.endereco?.message}
            registro={register('oficina.endereco')}
          />
          <CampoFormulario
            id="oficina-documento"
            label="CPF/CNPJ (opcional)"
            error={errors.oficina?.documento?.message}
            registro={register('oficina.documento')}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="font-display text-base uppercase tracking-wide text-muted-foreground">Você</legend>
          <CampoFormulario
            id="dono-nome"
            label="Seu nome"
            error={errors.dono?.nome?.message}
            registro={register('dono.nome')}
            autoComplete="name"
          />
          <CampoFormulario
            id="dono-email"
            label="Seu e-mail"
            type="email"
            error={errors.dono?.email?.message}
            registro={register('dono.email')}
            autoComplete="email"
          />
          <CampoFormulario
            id="dono-telefone"
            label="Seu WhatsApp (opcional)"
            type="tel"
            error={errors.dono?.telefone?.message}
            registro={register('dono.telefone')}
            autoComplete="tel"
          />
          <CampoFormulario
            id="dono-senha"
            label="Senha"
            type="password"
            error={errors.dono?.senha?.message}
            registro={register('dono.senha')}
            autoComplete="new-password"
          />
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <Controller
              control={control}
              name="aceiteTermos"
              render={({ field }) => (
                <Checkbox
                  id="aceiteTermos"
                  className="mt-0.5 size-5"
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={!!errors.aceiteTermos}
                  aria-describedby={errors.aceiteTermos ? 'aceiteTermos-erro' : undefined}
                />
              )}
            />
            <Label htmlFor="aceiteTermos" className="text-sm font-normal">
              Li e aceito os termos de uso
            </Label>
          </div>
          {errors.aceiteTermos && (
            <p id="aceiteTermos-erro" role="alert" className="text-sm text-destructive">
              {errors.aceiteTermos.message}
            </p>
          )}
        </div>

        <Button type="submit" className="h-11" disabled={mutacao.isPending}>
          {mutacao.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
        <p className="text-center text-sm">
          Já tem conta?{' '}
          <Link to="/entrar" className="text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </TelaPublica>
  );
}
