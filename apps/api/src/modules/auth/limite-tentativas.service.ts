import { Injectable } from '@nestjs/common';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';

export const MAX_FALHAS = 5;
export const JANELA_MS = 15 * 60_000;

/**
 * Falhas de login por conta (ou por identificador, quando a conta não existe), em memória.
 * Complementa o limite por IP do throttler. Não usa `FATOR_LIMITES`: é por conta, não por IP,
 * e os testes precisam do valor real. Bloqueio fixo de 5 falhas / 15 min: permite a quem sabe o
 * e-mail de um dono bloquear o login dele (trade-off registrado no docs/06). Uma instância da
 * API no MVP; com várias, mover para o Postgres ou Redis com chave (conta, IP).
 */
@Injectable()
export class LimiteTentativasService {
  private readonly falhas = new Map<string, { total: number; inicio: number }>();

  verificar(chave: string): void {
    const registro = this.falhas.get(chave);
    if (!registro) return;
    if (Date.now() - registro.inicio > JANELA_MS) {
      this.falhas.delete(chave);
      return;
    }
    if (registro.total >= MAX_FALHAS) {
      throw new ErroNegocio(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Tente de novo em alguns minutos');
    }
  }

  registrarFalha(chave: string): void {
    const agora = Date.now();
    const registro = this.falhas.get(chave);
    if (!registro || agora - registro.inicio > JANELA_MS) this.falhas.set(chave, { total: 1, inicio: agora });
    else registro.total += 1;
    if (this.falhas.size > 10_000) this.limparVencidos(agora);
  }

  limpar(chave: string): void {
    this.falhas.delete(chave);
  }

  private limparVencidos(agora: number): void {
    for (const [chave, r] of this.falhas) if (agora - r.inicio > JANELA_MS) this.falhas.delete(chave);
  }
}
