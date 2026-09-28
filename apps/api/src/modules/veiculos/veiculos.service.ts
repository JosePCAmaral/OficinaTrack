import { Injectable } from '@nestjs/common';
import type { AlterarVeiculo, FichaVeiculo, ResumoVeiculo } from '@oficinatrack/shared';
import { classificarTermo, placaParcial } from '../../common/busca/classificar-termo.js';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { Prisma } from '../../generated/prisma/client.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const CAMPOS_CLIENTE_RESUMO = { id: true, nome: true, telefone: true } as const;
const CAMPOS_FICHA = {
  id: true, placa: true, marca: true, modelo: true, anoModelo: true, cor: true, chassi: true, kmAtual: true, criadoEm: true,
  cliente: { select: CAMPOS_CLIENTE_RESUMO },
} as const;
const CAMPOS_RESUMO_BUSCA = { id: true, placa: true, marca: true, modelo: true, cliente: { select: { id: true, nome: true } } } as const;

type LinhaFicha = {
  id: string; placa: string; marca: string | null; modelo: string | null; anoModelo: number | null; cor: string | null;
  chassi: string | null; kmAtual: number | null; criadoEm: Date; cliente: { id: string; nome: string | null; telefone: string };
};

const paraFicha = (v: LinhaFicha): FichaVeiculo => ({ ...v, criadoEm: v.criadoEm.toISOString() });

const placaJaCadastrada = () => new ErroNegocio(409, 'PLACA_JA_CADASTRADA', 'Esta placa já está cadastrada para outro veículo');

@Injectable()
export class VeiculosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  /** Só os campos que a abertura de OS precisa (Tarefa 5): dono atual e km, para decidir reaproveitar ou transferir. */
  buscarPorPlaca(placa: string, db: Db = this.prisma.db) {
    return db.veiculo.findFirst({
      where: { placa },
      select: { id: true, clienteId: true, kmAtual: true, cliente: { select: CAMPOS_CLIENTE_RESUMO } },
    });
  }

  async buscarFichaPorPlaca(placa: string): Promise<FichaVeiculo | null> {
    const veiculo = await this.prisma.db.veiculo.findFirst({ where: { placa }, select: CAMPOS_FICHA });
    return veiculo ? paraFicha(veiculo) : null;
  }

  criar(tx: Tx, dados: { placa: string; clienteId: string; kmAtual?: number }) {
    return tx.veiculo.create({
      data: { oficinaId: this.tenant.oficinaIdAtual(), placa: dados.placa, clienteId: dados.clienteId, kmAtual: dados.kmAtual ?? null },
      select: { id: true, placa: true, clienteId: true, kmAtual: true },
    });
  }

  /** Veículo antigo do cliente identificado pelo WhatsApp que trocou de dono (fluxo de abertura, Tarefa 5). */
  transferir(tx: Tx, veiculoId: string, clienteId: string) {
    return tx.veiculo.update({ where: { id: veiculoId }, data: { clienteId }, select: { id: true, placa: true, clienteId: true } });
  }

  /** Nunca reduz o km registrado (odômetro não anda pra trás). */
  atualizarKmSeMaior(tx: Tx, veiculoId: string, km: number) {
    return tx.veiculo.updateMany({ where: { id: veiculoId, OR: [{ kmAtual: null }, { kmAtual: { lt: km } }] }, data: { kmAtual: km } });
  }

  async ficha(id: string): Promise<FichaVeiculo> {
    const veiculo = await this.prisma.db.veiculo.findUnique({ where: { id }, select: CAMPOS_FICHA });
    if (!veiculo) throw new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Veículo não encontrado');
    return paraFicha(veiculo);
  }

  /** Placa repetida para outro veículo: pré-checagem (mensagem melhor) + P2002 mapeado (corrida). */
  async alterar(id: string, dados: AlterarVeiculo): Promise<FichaVeiculo> {
    if (dados.placa) {
      const emUso = await this.prisma.db.veiculo.findFirst({ where: { placa: dados.placa, id: { not: id } }, select: { id: true } });
      if (emUso) throw placaJaCadastrada();
    }
    try {
      const atualizado = await this.prisma.db.veiculo.update({ where: { id }, data: dados, select: CAMPOS_FICHA });
      return paraFicha(atualizado);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') throw placaJaCadastrada();
      throw erro;
    }
  }

  /**
   * Placa exata (termo classificado como placa) OU placa parcial (`startsWith`, útil no balcão
   * mesmo quando o termo não fecha uma placa válida, ex.: "ABC1" de 4 caracteres).
   */
  buscar(termo: string): Promise<ResumoVeiculo[]> {
    const classificado = classificarTermo(termo);
    const condicoes: Prisma.VeiculoWhereInput[] = [];
    if (classificado.tipo === 'placa') condicoes.push({ placa: classificado.valor });
    const parcial = placaParcial(termo);
    if (parcial) condicoes.push({ placa: { startsWith: parcial } });
    if (condicoes.length === 0) return Promise.resolve([]);
    return this.prisma.db.veiculo.findMany({
      where: { OR: condicoes },
      select: CAMPOS_RESUMO_BUSCA,
      take: 10,
      orderBy: { criadoEm: 'desc' },
    });
  }
}
