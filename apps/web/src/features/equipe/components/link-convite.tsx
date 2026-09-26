import type { ConviteCriado } from '@oficinatrack/shared';
import { Button } from '@/components/ui/button';

function montarLinkWhatsapp(telefone: string | null, mensagem: string): string {
  const texto = encodeURIComponent(mensagem);
  if (!telefone) return `https://wa.me/?text=${texto}`;
  return `https://wa.me/${telefone.replace('+', '')}?text=${texto}`;
}

export function montarMensagemConvite(nomeConvidado: string, nomeOficina: string, link: string): string {
  return `Olá, ${nomeConvidado}! A ${nomeOficina} convidou você para usar o OficinaTrack. Crie sua senha por este link (vale 72 horas): ${link}`;
}

export function LinkConvite({ convite, nomeOficina }: { convite: ConviteCriado; nomeOficina: string }) {
  const mensagem = montarMensagemConvite(convite.convite.nome, nomeOficina, convite.link);
  const linkWhatsapp = montarLinkWhatsapp(convite.convite.telefone, mensagem);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(convite.link);
    } catch {
      // Sem permissão de área de transferência (ex.: contexto inseguro): o link já está visível na tela.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="break-all rounded-md bg-muted p-2 text-sm">{convite.link}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="h-11">
          <a href={linkWhatsapp} target="_blank" rel="noreferrer">
            Enviar pelo WhatsApp
          </a>
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => void copiarLink()}>
          Copiar link
        </Button>
      </div>
    </div>
  );
}
