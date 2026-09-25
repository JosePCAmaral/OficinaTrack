import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { hashToken } from '../../common/seguranca/tokens.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { PrismaService, type Tx } from '../../prisma/prisma.service.js';

// sem 0/O, 1/I/L: o código é digitado à mão pelo dono
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const normalizar = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
const invalido = () => new ErroNegocio(400, 'CODIGO_PILOTO_INVALIDO', 'Código de acesso inválido ou já usado');

@Injectable()
export class CodigosPilotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  /** Gera um código no formato XXXX-XXXX-XXXX; o banco guarda só o hash. */
  async gerar(descricao: string, validadeDias = 30): Promise<string> {
    const bruto = Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
    const codigo = `${bruto.slice(0, 4)}-${bruto.slice(4, 8)}-${bruto.slice(8)}`;
    // sem tenant: CodigoPiloto é global (do administrador), não pertence a uma oficina
    await this.tenant.executarSemTenant(() =>
      this.prisma.db.codigoPiloto.create({
        data: { codigoHash: hashToken(bruto), descricao, expiraEm: new Date(Date.now() + validadeDias * 86_400_000) },
      }),
    );
    return codigo;
  }

  /** Dentro da transação do cadastro (sem tenant). Atômico: dois cadastros com o mesmo código não passam. */
  async consumir(tx: Tx, codigo: string | undefined, oficinaId: string): Promise<void> {
    if (!codigo) throw invalido();
    const marcado = await tx.codigoPiloto.updateMany({
      where: { codigoHash: hashToken(normalizar(codigo)), usadoEm: null, expiraEm: { gt: new Date() } },
      data: { usadoEm: new Date(), oficinaId },
    });
    if (marcado.count !== 1) throw invalido();
  }
}
