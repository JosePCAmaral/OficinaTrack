import { Injectable, Logger } from '@nestjs/common';
import {
  formatarNumeroOS, SITUACOES_ABERTAS,
  type AbrirOs, type AlterarOs, type ConsultaPlaca, type DetalheOS, type Pagina, type Paginacao, type ResumoOS,
} from '@oficinatrack/shared';
import { argsPaginacao, paginar } from '../../common/paginacao.js';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ehConflitoDeTransacao } from '../../prisma/conflito-transacao.js';
import { conflitoEnvolveCampo } from '../../prisma/conflito-unicidade.js';
import { PrismaService, type Db } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/decorators.js';
import { ClientesService } from '../clientes/clientes.service.js';
import { OficinasService } from '../oficinas/oficinas.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { VeiculosService } from '../veiculos/veiculos.service.js';
import { CAMPOS_DETALHE, CAMPOS_RESUMO, paraDetalhe, paraMeioDia, paraResumo } from './mapeadores.js';

const osNaoEncontrada = () => new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Ordem de serviço não encontrada');
const responsavelInvalido = () => new ErroNegocio(422, 'RESPONSAVEL_INVALIDO', 'Responsável não encontrado ou inativo');

/**
 * Corrida entre duas aberturas: as duas criando o mesmo cliente (telefone) ou o mesmo veículo
 * (placa) novos. Quem perde recebe P2002 e, repetindo a transação, já enxerga o registro criado.
 */
const ehCorridaDeAbertura = (erro: unknown) =>
  conflitoEnvolveCampo(erro, 'telefone') || conflitoEnvolveCampo(erro, 'placa') || ehConflitoDeTransacao(erro);

/** Como o cliente aparece em texto gravado (LGPD): o nome ou, sem nome, só os 4 últimos dígitos. */
const identificarCliente = (c: { nome: string | null; telefone: string }) => c.nome ?? `cliente com telefone final ${c.telefone.slice(-4)}`;

@Injectable()
export class OrdensServicoService {
  private readonly logger = new Logger(OrdensServicoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly clientes: ClientesService,
    private readonly veiculos: VeiculosService,
    private readonly oficinas: OficinasService,
    private readonly usuarios: UsuariosService,
  ) {}

  /**
   * Abertura rápida numa única transação: reaproveita cliente (telefone) e veículo (placa),
   * aplica D4 (OS aberta → 409, a menos que `criarMesmoComOsAberta`) e D1 (placa de outro dono →
   * 409, a menos que venha `transferirVeiculo`), reserva o número e grava a OS com `OS_ABERTA`.
   *
   * O número é reservado ANTES da checagem D4: o UPDATE…increment na linha da oficina serializa as
   * aberturas concorrentes da mesma oficina, e a segunda (READ COMMITTED) já enxerga a OS da
   * primeira. Um 409 (D4/D1) desfaz a transação inteira, inclusive a reserva do número.
   */
  async abrir(dados: AbrirOs, ator: UsuarioAutenticado): Promise<DetalheOS> {
    const id = await this.comRetentativa(() =>
      this.prisma.db.$transaction(async (tx) => {
        const numero = await this.oficinas.reservarNumeroOS(tx);
        const existente = await this.veiculos.buscarPorPlaca(dados.placa, tx);
        if (existente && !dados.criarMesmoComOsAberta) {
          const aberta = await this.osAbertaDoVeiculo(existente.id, tx);
          if (aberta) {
            throw new ErroNegocio(409, 'OS_ABERTA_EXISTENTE', `Este carro já está na OS ${formatarNumeroOS(aberta.numero)}`, {
              id: aberta.id, numero: aberta.numero, criadoEm: aberta.criadoEm.toISOString(),
            });
          }
        }

        const cliente = await this.clientes.obterOuCriar(tx, { telefone: dados.telefone, nome: dados.nomeCliente });
        let veiculoId: string;
        let transferencia: { de: string; para: string } | null = null;
        if (!existente) {
          veiculoId = (await this.veiculos.criar(tx, { placa: dados.placa, clienteId: cliente.id, kmAtual: dados.kmEntrada })).id;
        } else {
          veiculoId = existente.id;
          if (existente.cliente.id !== cliente.id) {
            if (dados.transferirVeiculo === undefined) {
              // só o nome e os 4 últimos dígitos: o suficiente para o balcão reconhecer o dono
              throw new ErroNegocio(409, 'VEICULO_DE_OUTRO_CLIENTE', 'Esta placa está cadastrada com outro cliente', {
                dono: { nome: existente.cliente.nome, telefoneFinal: existente.cliente.telefone.slice(-4) },
              });
            }
            if (dados.transferirVeiculo) {
              await this.veiculos.transferir(tx, existente.id, cliente.id);
              transferencia = { de: identificarCliente(existente.cliente), para: identificarCliente(cliente) };
            }
          }
        }

        if (dados.responsavelId && !(await this.usuarios.buscarAtivo(dados.responsavelId, tx))) throw responsavelInvalido();
        if (dados.kmEntrada !== undefined && existente) await this.veiculos.atualizarKmSeMaior(tx, veiculoId, dados.kmEntrada);

        const oficinaId = this.tenant.oficinaIdAtual();
        const os = await tx.ordemServico.create({
          data: {
            oficinaId, numero, veiculoId, clienteId: cliente.id, relatoCliente: dados.relatoCliente,
            kmEntrada: dados.kmEntrada ?? null,
            responsavelId: dados.responsavelId ?? null,
            previsaoEntrega: dados.previsaoEntrega ? paraMeioDia(dados.previsaoEntrega) : null,
          },
          select: { id: true },
        });
        const autorId = ator.id;
        await tx.eventoOS.create({ data: { oficinaId, ordemServicoId: os.id, autorId, tipo: 'OS_ABERTA', visivelCliente: true } });
        if (transferencia) {
          await tx.eventoOS.create({
            data: {
              oficinaId, ordemServicoId: os.id, autorId, tipo: 'VEICULO_TRANSFERIDO', visivelCliente: false,
              texto: `Veículo transferido de ${transferencia.de} para ${transferencia.para}`,
            },
          });
        }
        return os.id;
      }),
    );
    return this.detalhe(id);
  }

  async detalhe(id: string): Promise<DetalheOS> {
    const os = await this.prisma.db.ordemServico.findUnique({ where: { id }, select: CAMPOS_DETALHE });
    if (!os) throw osNaoEncontrada();
    return paraDetalhe(os);
  }

  /**
   * Status não muda aqui (só por `alterarStatus`, Sprint 4). `null` limpa; km maior também atualiza o veículo.
   * O responsável só é validado quando muda: reenviar o atual (mesmo que desativado depois) não bloqueia a edição.
   */
  async alterar(id: string, dados: AlterarOs): Promise<DetalheOS> {
    await this.prisma.db.$transaction(async (tx) => {
      const atual = await tx.ordemServico.findUnique({ where: { id }, select: { veiculoId: true, responsavelId: true } });
      if (!atual) throw osNaoEncontrada();
      if (dados.responsavelId && dados.responsavelId !== atual.responsavelId && !(await this.usuarios.buscarAtivo(dados.responsavelId, tx))) throw responsavelInvalido();

      const { previsaoEntrega, ...resto } = dados;
      const data: Prisma.OrdemServicoUncheckedUpdateInput = { ...resto };
      if (previsaoEntrega !== undefined) data.previsaoEntrega = previsaoEntrega ? paraMeioDia(previsaoEntrega) : null;
      await tx.ordemServico.update({ where: { id }, data, select: { id: true } });
      if (typeof dados.kmEntrada === 'number') await this.veiculos.atualizarKmSeMaior(tx, atual.veiculoId, dados.kmEntrada);
    });
    return this.detalhe(id);
  }

  listarAbertas(p: Paginacao): Promise<Pagina<ResumoOS>> {
    return this.listar({ status: { in: [...SITUACOES_ABERTAS] } }, p);
  }

  async listarPorVeiculo(veiculoId: string, p: Paginacao): Promise<Pagina<ResumoOS>> {
    await this.veiculos.ficha(veiculoId); // 404 se o veículo não é desta oficina
    return this.listar({ veiculoId }, p);
  }

  async listarPorCliente(clienteId: string, p: Paginacao): Promise<Pagina<ResumoOS>> {
    if (!(await this.clientes.buscarPorId(clienteId))) throw new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Cliente não encontrado');
    return this.listar({ clienteId }, p);
  }

  osAbertaDoVeiculo(veiculoId: string, db: Db = this.prisma.db): Promise<{ id: string; numero: number; criadoEm: Date } | null> {
    return db.ordemServico.findFirst({
      where: { veiculoId, status: { in: [...SITUACOES_ABERTAS] } },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, numero: true, criadoEm: true },
    });
  }

  /** Checagem do balcão ao digitar a placa: veículo, dono e a OS em aberto (D4). */
  async consultarPlaca(placa: string): Promise<ConsultaPlaca> {
    const veiculo = await this.veiculos.buscarFichaPorPlaca(placa);
    if (!veiculo) throw new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Veículo não encontrado');
    const aberta = await this.osAbertaDoVeiculo(veiculo.id);
    return { veiculo, osAberta: aberta ? { ...aberta, criadoEm: aberta.criadoEm.toISOString() } : null };
  }

  /**
   * Mais recentes primeiro por `numero` (único na oficina, serve de desempate do cursor e reflete
   * a ordem real de abertura mesmo quando duas transações começam fora de ordem).
   * Cursor que não é uma OS desta oficina → página vazia: o `cursor` do Prisma não passa pela
   * extensão de tenant e, sem essa checagem, a posição de uma OS alheia serviria de referência.
   */
  private async listar(where: Prisma.OrdemServicoWhereInput, p: Paginacao): Promise<Pagina<ResumoOS>> {
    if (p.cursor && !(await this.prisma.db.ordemServico.findFirst({ where: { id: p.cursor }, select: { id: true } }))) {
      return { itens: [], proximoCursor: null };
    }
    const linhas = await this.prisma.db.ordemServico.findMany({
      where, orderBy: { numero: 'desc' }, select: CAMPOS_RESUMO, ...argsPaginacao(p),
    });
    return paginar(linhas.map(paraResumo), p.limite);
  }

  private async comRetentativa<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (erro) {
      if (!ehCorridaDeAbertura(erro)) throw erro;
      this.logger.warn('Abertura de OS repetida após corrida com outro pedido (cliente/veículo novo ou conflito de transação)');
      return fn();
    }
  }
}
