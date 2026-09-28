import { Injectable } from '@nestjs/common';
import type { AlterarCliente, FichaCliente, ResumoCliente } from '@oficinatrack/shared';
import { classificarTermo } from '../../common/busca/classificar-termo.js';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { Prisma } from '../../generated/prisma/client.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { conflitoEnvolveCampo } from '../../prisma/conflito-unicidade.js';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const CAMPOS_RESUMO = { id: true, nome: true, telefone: true } as const;
const CAMPOS_VEICULO_RESUMO = { id: true, placa: true, marca: true, modelo: true } as const;
const CAMPOS_FICHA = {
  id: true, nome: true, telefone: true, email: true, documento: true, observacoes: true, criadoEm: true,
  veiculos: { select: CAMPOS_VEICULO_RESUMO, orderBy: { criadoEm: 'desc' as const } },
} as const;

type LinhaFicha = {
  id: string; nome: string | null; telefone: string; email: string | null; documento: string | null;
  observacoes: string | null; criadoEm: Date; veiculos: { id: string; placa: string; marca: string | null; modelo: string | null }[];
};

const paraFicha = (c: LinhaFicha): FichaCliente => ({ ...c, criadoEm: c.criadoEm.toISOString() });

const telefoneJaCadastrado = () => new ErroNegocio(409, 'TELEFONE_JA_CADASTRADO', 'Este telefone já está cadastrado para outro cliente');

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  /**
   * Dentro da transação da abertura. `findFirst` (e não `findUnique`) porque a chave única é
   * composta com `oficinaId`, que a extensão de tenant acrescenta sozinha.
   * Corrida no mesmo telefone novo: o `create` perdedor dá P2002 e quem chama repete a transação.
   */
  async obterOuCriar(tx: Tx, { telefone, nome }: { telefone: string; nome?: string }) {
    const existente = await tx.cliente.findFirst({ where: { telefone }, select: CAMPOS_RESUMO });
    if (existente) {
      if (nome && !existente.nome) {
        return { ...(await tx.cliente.update({ where: { id: existente.id }, data: { nome }, select: CAMPOS_RESUMO })), criado: false };
      }
      return { ...existente, criado: false };
    }
    const criado = await tx.cliente.create({
      data: { oficinaId: this.tenant.oficinaIdAtual(), telefone, nome: nome ?? null },
      select: CAMPOS_RESUMO,
    });
    return { ...criado, criado: true };
  }

  buscarPorId(id: string, db: Db = this.prisma.db) {
    return db.cliente.findFirst({ where: { id }, select: CAMPOS_RESUMO });
  }

  async ficha(id: string): Promise<FichaCliente> {
    const cliente = await this.prisma.db.cliente.findUnique({ where: { id }, select: CAMPOS_FICHA });
    if (!cliente) throw new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Cliente não encontrado');
    return paraFicha(cliente);
  }

  /** Telefone repetido para outro cliente: pré-checagem (mensagem melhor) + P2002 mapeado (corrida). */
  async alterar(id: string, dados: AlterarCliente): Promise<FichaCliente> {
    if (dados.telefone) {
      const emUso = await this.prisma.db.cliente.findFirst({ where: { telefone: dados.telefone, id: { not: id } }, select: { id: true } });
      if (emUso) throw telefoneJaCadastrado();
    }
    try {
      const atualizado = await this.prisma.db.cliente.update({ where: { id }, data: dados, select: CAMPOS_FICHA });
      return paraFicha(atualizado);
    } catch (erro) {
      if (conflitoEnvolveCampo(erro, 'telefone')) throw telefoneJaCadastrado();
      throw erro;
    }
  }

  /** Classifica o termo: placa não busca cliente; telefone busca exato; senão, nome por trecho. */
  buscar(termo: string): Promise<ResumoCliente[]> {
    const classificado = classificarTermo(termo);
    if (classificado.tipo === 'placa') return Promise.resolve([]);
    const where = classificado.tipo === 'telefone'
      ? { telefone: classificado.valor }
      : { nome: { contains: classificado.valor, mode: Prisma.QueryMode.insensitive } };
    return this.prisma.db.cliente.findMany({ where, select: CAMPOS_RESUMO, take: 10, orderBy: { criadoEm: 'desc' } });
  }
}
