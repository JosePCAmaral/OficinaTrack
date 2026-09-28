import { zodResolver } from '@hookform/resolvers/zod';
import {
  abrirOsSchema,
  formatarNumeroOS,
  normalizarPlaca,
  type AbrirOs,
  type AbrirOsEntrada,
} from '@oficinatrack/shared';
import { useState } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { CampoFormulario } from '@/components/campo-formulario';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/contexto/use-auth';
import { usePermissao } from '@/features/auth/hooks/use-permissao';
import { useEquipe } from '@/features/equipe/api/use-equipe';
import { ErroApi } from '@/lib/api';
import { tempoDesde } from '@/lib/formatar-data';
import { useAbrirOs } from '../api/use-abrir-os';
import { useConsultaPlaca } from '../api/use-consulta-placa';
import { CampoPlaca } from '../components/campo-placa';
import { CampoTelefone, formatarTelefoneExibicao } from '../components/campo-telefone';
import { DialogoDonoDiferente, type DonoAtual } from '../components/dialogo-dono-diferente';
import { DialogoOsAberta, type OsAbertaExistente } from '../components/dialogo-os-aberta';

const QUEIXA_MAX = 1000;

type DetalheErro = { campo: string; mensagem: string };

export function AbrirOs() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [searchParams] = useSearchParams();
  const placaInicial = (searchParams.get('placa') ?? '').toUpperCase();
  const podeGerenciarEquipe = usePermissao('EQUIPE_GERENCIAR');
  const equipe = useEquipe({ enabled: podeGerenciarEquipe });

  const abrirOs = useAbrirOs();
  const consultarPlaca = useConsultaPlaca();

  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [infoVeiculo, setInfoVeiculo] = useState<{ modelo: string | null; marca: string | null; cor: string | null } | null>(null);
  const [osAbertaInline, setOsAbertaInline] = useState<OsAbertaExistente | null>(null);
  const [criarMesmoInline, setCriarMesmoInline] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [dialogoOsAberta, setDialogoOsAberta] = useState<{ os: OsAbertaExistente; dadosPendentes: AbrirOs } | null>(null);
  const [dialogoDonoDiferente, setDialogoDonoDiferente] = useState<{
    dono: DonoAtual;
    novoDono: string;
    dadosPendentes: AbrirOs;
  } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<AbrirOsEntrada>({
    resolver: zodResolver(abrirOsSchema),
    defaultValues: { placa: placaInicial, telefone: '', relatoCliente: '', nomeCliente: '', responsavelId: '', previsaoEntrega: '' },
  });

  const queixa = useWatch({ control, name: 'relatoCliente' }) ?? '';

  async function aoSairPlaca(valor: string) {
    setInfoVeiculo(null);
    setOsAbertaInline(null);
    setCriarMesmoInline(false);
    if (!normalizarPlaca(valor)) return;
    try {
      const resultado = await consultarPlaca.mutateAsync(valor);
      setInfoVeiculo({ modelo: resultado.veiculo.modelo, marca: resultado.veiculo.marca, cor: resultado.veiculo.cor });
      if (!getValues('telefone')) setValue('telefone', formatarTelefoneExibicao(resultado.veiculo.cliente.telefone));
      if (!getValues('nomeCliente')) setValue('nomeCliente', resultado.veiculo.cliente.nome ?? '');
      setOsAbertaInline(resultado.osAberta);
    } catch (erro) {
      // Placa desconhecida (404) ou outra falha na consulta: não bloqueia a abertura, só não pré-preenche.
      if (erro instanceof ErroApi && erro.statusCode === 404) return;
    }
  }

  function tratarErroAbrir(erro: unknown, dados: AbrirOs) {
    if (erro instanceof ErroApi) {
      if (erro.code === 'OS_ABERTA_EXISTENTE') {
        setOsAbertaInline(null);
        setDialogoOsAberta({ os: erro.details as OsAbertaExistente, dadosPendentes: dados });
        return;
      }
      if (erro.code === 'VEICULO_DE_OUTRO_CLIENTE') {
        const detalhes = erro.details as { dono: DonoAtual };
        const novoDono = dados.nomeCliente?.trim() || formatarTelefoneExibicao(dados.telefone);
        setDialogoDonoDiferente({ dono: detalhes.dono, novoDono, dadosPendentes: dados });
        return;
      }
      if (erro.code === 'RESPONSAVEL_INVALIDO') {
        setError('responsavelId', { message: erro.message });
        return;
      }
      if (erro.code === 'VALIDACAO_FALHOU' && Array.isArray(erro.details)) {
        for (const detalhe of erro.details as DetalheErro[]) {
          setError(detalhe.campo as FieldPath<AbrirOsEntrada>, { message: detalhe.mensagem });
        }
        return;
      }
      setErroGeral(erro.message);
      return;
    }
    setErroGeral('Não foi possível completar a ação. Tente de novo.');
  }

  async function aoEnviar(dadosEntrada: AbrirOsEntrada) {
    setErroGeral(null);
    const dados = dadosEntrada as unknown as AbrirOs;
    try {
      const os = await abrirOs.mutateAsync({ ...dados, criarMesmoComOsAberta: criarMesmoInline || undefined });
      navigate(`/painel/os/${os.id}`);
    } catch (erro) {
      tratarErroAbrir(erro, dados);
    }
  }

  async function aoConfirmarCriarMesmoAssim() {
    if (!dialogoOsAberta || abrirOs.isPending) return;
    const dados: AbrirOs = { ...dialogoOsAberta.dadosPendentes, criarMesmoComOsAberta: true };
    setErroGeral(null);
    try {
      const os = await abrirOs.mutateAsync(dados);
      setDialogoOsAberta(null);
      navigate(`/painel/os/${os.id}`);
    } catch (erro) {
      setDialogoOsAberta(null);
      tratarErroAbrir(erro, dados);
    }
  }

  async function aoConfirmarTransferir(transferirVeiculo: boolean) {
    if (!dialogoDonoDiferente || abrirOs.isPending) return;
    const dados: AbrirOs = { ...dialogoDonoDiferente.dadosPendentes, transferirVeiculo };
    setErroGeral(null);
    try {
      const os = await abrirOs.mutateAsync(dados);
      setDialogoDonoDiferente(null);
      navigate(`/painel/os/${os.id}`);
    } catch (erro) {
      setDialogoDonoDiferente(null);
      tratarErroAbrir(erro, dados);
    }
  }

  const membrosAtivos = (equipe.data ?? []).filter((m) => m.ativo);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl uppercase tracking-wide">Abrir OS</h1>

      {erroGeral && (
        <Alert variant="destructive">
          <AlertDescription>{erroGeral}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Controller
            control={control}
            name="placa"
            render={({ field }) => (
              <CampoPlaca
                id="os-placa"
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={() => {
                  field.onBlur();
                  void aoSairPlaca(field.value ?? '');
                }}
                error={errors.placa?.message}
              />
            )}
          />
          {infoVeiculo && (
            <p className="text-sm text-muted-foreground">
              {[infoVeiculo.modelo, infoVeiculo.cor].filter(Boolean).join(' · ') || 'Veículo encontrado'}
            </p>
          )}
        </div>

        {osAbertaInline && (
          <Alert>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                Este carro já está na OS {formatarNumeroOS(osAbertaInline.numero)}, aberta {tempoDesde(osAbertaInline.criadoEm)}.
              </span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => navigate(`/painel/os/${osAbertaInline.id}`)}
                >
                  Abrir {formatarNumeroOS(osAbertaInline.numero)}
                </Button>
                <Button
                  type="button"
                  className="h-11"
                  onClick={() => {
                    setCriarMesmoInline(true);
                    setOsAbertaInline(null);
                  }}
                >
                  Criar nova mesmo assim
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Controller
          control={control}
          name="telefone"
          render={({ field }) => (
            <CampoTelefone
              id="os-telefone"
              label="WhatsApp do cliente"
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.telefone?.message}
            />
          )}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="os-queixa">Queixa do cliente</Label>
            <span className="text-xs text-muted-foreground">
              {queixa.length}/{QUEIXA_MAX}
            </span>
          </div>
          <Textarea
            id="os-queixa"
            maxLength={QUEIXA_MAX}
            aria-invalid={!!errors.relatoCliente}
            aria-describedby={errors.relatoCliente ? 'os-queixa-erro' : undefined}
            {...register('relatoCliente')}
          />
          {errors.relatoCliente && (
            <p id="os-queixa-erro" role="alert" className="text-sm text-destructive">
              {errors.relatoCliente.message}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-11 w-fit self-start px-0"
          aria-expanded={mostrarDetalhes}
          onClick={() => setMostrarDetalhes((v) => !v)}
        >
          {mostrarDetalhes ? 'Menos detalhes' : 'Mais detalhes'}
        </Button>

        {mostrarDetalhes && (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <CampoFormulario
              id="os-nome-cliente"
              label="Nome do cliente"
              error={errors.nomeCliente?.message}
              registro={register('nomeCliente')}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="os-km">Km de entrada</Label>
              <Input
                id="os-km"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={!!errors.kmEntrada}
                aria-describedby={errors.kmEntrada ? 'os-km-erro' : undefined}
                className="h-11"
                {...register('kmEntrada')}
              />
              {errors.kmEntrada && (
                <p id="os-km-erro" role="alert" className="text-sm text-destructive">
                  {errors.kmEntrada.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="os-responsavel">Responsável</Label>
              {/* Select nativo: no celular abre o seletor do sistema (rápido, sem digitar) e evita a
                  complexidade de um combobox customizado para uma lista curta de nomes. */}
              <select
                id="os-responsavel"
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                {...register('responsavelId')}
              >
                {podeGerenciarEquipe ? (
                  <>
                    <option value="">Selecione</option>
                    {membrosAtivos.map((membro) => (
                      <option key={membro.id} value={membro.id}>
                        {membro.nome}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value={usuario?.id ?? ''}>Eu</option>
                    <option value="">Ninguém</option>
                  </>
                )}
              </select>
            </div>

            <CampoFormulario
              id="os-previsao"
              label="Previsão de entrega"
              type="date"
              error={errors.previsaoEntrega?.message}
              registro={register('previsaoEntrega')}
            />
          </div>
        )}

        <Button type="submit" className="h-11" disabled={abrirOs.isPending}>
          {abrirOs.isPending ? 'Abrindo…' : 'Abrir OS'}
        </Button>
      </form>

      <DialogoOsAberta
        aberto={!!dialogoOsAberta}
        os={dialogoOsAberta?.os ?? null}
        pendente={abrirOs.isPending}
        onAbrirExistente={(os) => {
          setDialogoOsAberta(null);
          navigate(`/painel/os/${os.id}`);
        }}
        onCriarMesmoAssim={() => void aoConfirmarCriarMesmoAssim()}
        onCancelar={() => setDialogoOsAberta(null)}
      />

      <DialogoDonoDiferente
        aberto={!!dialogoDonoDiferente}
        dono={dialogoDonoDiferente?.dono ?? null}
        novoDono={dialogoDonoDiferente?.novoDono ?? ''}
        pendente={abrirOs.isPending}
        onSim={() => void aoConfirmarTransferir(true)}
        onNao={() => void aoConfirmarTransferir(false)}
        onCancelar={() => setDialogoDonoDiferente(null)}
      />
    </div>
  );
}
