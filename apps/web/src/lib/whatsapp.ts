import { formatarPlaca } from '@oficinatrack/shared';

/**
 * Link do WhatsApp Web/app para o telefone (E.164, ex. `+5543999998888`). Sem texto, abre só a
 * conversa; com texto, usa `encodeURIComponent` para acentos, `&`, `#`, quebra de linha e emoji
 * não quebrarem a URL (Review Focus 3).
 */
export function linkWhatsApp(telefoneE164: string, texto: string): string {
  const numero = telefoneE164.replace(/^\+/, '');
  return texto ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/${numero}`;
}

type VeiculoMensagem = { modelo: string | null; placa: string };

/** Texto de "Avisar no WhatsApp": nome do cliente (ou "tudo bem") e modelo (ou placa formatada). */
export function mensagemAtualizacao(params: {
  nomeCliente: string | null;
  nomeOficina: string;
  veiculo: VeiculoMensagem;
  texto: string;
}): string {
  const { nomeCliente, nomeOficina, veiculo, texto } = params;
  const nome = nomeCliente ?? 'tudo bem';
  const identificacaoVeiculo = veiculo.modelo ?? formatarPlaca(veiculo.placa);
  return `Olá, ${nome}! ${nomeOficina} sobre o ${identificacaoVeiculo}: ${texto}`;
}
