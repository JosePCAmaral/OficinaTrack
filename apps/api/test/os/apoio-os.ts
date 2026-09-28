import { randomInt } from 'node:crypto';
import { telefoneTeste } from '../telefone-teste.js';
import type { App } from '../auth/apoio-auth.js';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letra = () => LETRAS[randomInt(0, 26)];
const digito = () => String(randomInt(0, 10));

/** Placa Mercosul aleatória (LLL D L DD), resistente a colisão (o banco de teste nunca é zerado). */
export const placaUnica = () => `${letra()}${letra()}${letra()}${digito()}${letra()}${digito()}${digito()}`;

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function criarClienteNa(ctx: App, oficinaId: string, dados: { nome?: string | null; telefone?: string } = {}) {
  return ctx.tenant.executarComo(oficinaId, () =>
    ctx.prisma.db.cliente.create({
      data: { oficinaId, nome: dados.nome ?? null, telefone: dados.telefone ?? telefoneTeste() },
    }),
  );
}

export async function criarVeiculoNa(ctx: App, oficinaId: string, clienteId: string, placa: string = placaUnica()) {
  return ctx.tenant.executarComo(oficinaId, () => ctx.prisma.db.veiculo.create({ data: { oficinaId, clienteId, placa } }));
}
