import { Injectable } from '@nestjs/common';
import {
  temPermissao,
  type EventoOSDto, type NovoEvento, type Pagina, type Paginacao, type StatusOS, type TipoEvento,
} from '@oficinatrack/shared';
import { argsPaginacao, paginar } from '../../common/paginacao.js';
import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { TenantContext } from '../../common/tenant/tenant-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/decorators.js';

const CAMPOS_EVENTO = {
  id: true, tipo: true, texto: true, visivelCliente: true, criadoEm: true,
  statusDe: true, statusPara: true,
  autor: { select: { id: true, nome: true } },
  retiradoEm: true, retiradoPor: { select: { id: true, nome: true } },
} as const;

type LinhaEvento = {
  id: string; tipo: TipoEvento; texto: string | null; visivelCliente: boolean; criadoEm: Date;
  statusDe: StatusOS | null; statusPara: StatusOS | null;
  autor: { id: string; nome: string } | null;
  retiradoEm: Date | null; retiradoPor: { id: string; nome: string } | null;
};

const paraDto = (e: LinhaEvento): EventoOSDto => ({
  ...e,
  criadoEm: e.criadoEm.toISOString(),
  retiradoEm: e.retiradoEm ? e.retiradoEm.toISOString() : null,
});

const osNaoEncontrada = () => new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Ordem de serviço não encontrada');
const eventoNaoEncontrado = () => new ErroNegocio(404, 'RECURSO_NAO_ENCONTRADO', 'Evento não encontrado');
const eventoNaoRetiravel = () => new ErroNegocio(422, 'EVENTO_NAO_RETIRAVEL', 'Este evento não pode ser retirado');
const semPermissao = () => new ErroNegocio(403, 'SEM_PERMISSAO', 'Você não tem permissão para esta ação');

/**
 * Linha do tempo da OS: notas internas (nunca visíveis ao cliente) e atualizações para o cliente
 * (visíveis, podem ser retiradas do portal sem apagar o registro). `visivelCliente` é sempre
 * derivado do `tipo`, nunca aceito do body (Review Focus 4).
 */
@Injectable()
export class EventosOsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  async listar(osId: string, p: Paginacao): Promise<Pagina<EventoOSDto>> {
    await this.confirmarOs(osId);
    if (p.cursor && !(await this.prisma.db.eventoOS.findFirst({ where: { id: p.cursor, ordemServicoId: osId }, select: { id: true } }))) {
      return { itens: [], proximoCursor: null };
    }
    const linhas = await this.prisma.db.eventoOS.findMany({
      where: { ordemServicoId: osId },
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      select: CAMPOS_EVENTO,
      ...argsPaginacao(p),
    });
    return paginar(linhas.map(paraDto), p.limite);
  }

  async publicar(osId: string, dados: NovoEvento, ator: UsuarioAutenticado): Promise<EventoOSDto> {
    await this.confirmarOs(osId);
    const visivelCliente = dados.tipo === 'ATUALIZACAO_CLIENTE';
    const evento = await this.prisma.db.eventoOS.create({
      data: {
        oficinaId: this.tenant.oficinaIdAtual(),
        ordemServicoId: osId,
        autorId: ator.id,
        tipo: dados.tipo,
        texto: dados.texto,
        visivelCliente,
      },
      select: CAMPOS_EVENTO,
    });
    return paraDto(evento);
  }

  /**
   * Ordem das checagens: 404 se o evento não é desta OS, 422 se não é uma atualização retirável,
   * 403 se quem retira não é o autor e não tem `EQUIPE_GERENCIAR`. O `updateMany` final é atômico
   * (`retiradoEm: null` na condição): a segunda de duas retiradas simultâneas encontra 0 linhas e
   * recebe 422, mesmo que a leitura anterior ainda visse o evento como retirável.
   */
  async retirar(osId: string, eventoId: string, ator: UsuarioAutenticado): Promise<EventoOSDto> {
    await this.confirmarOs(osId);
    const evento = await this.prisma.db.eventoOS.findFirst({
      where: { id: eventoId, ordemServicoId: osId },
      select: { id: true, tipo: true, autorId: true, retiradoEm: true },
    });
    if (!evento) throw eventoNaoEncontrado();
    if (evento.tipo !== 'ATUALIZACAO_CLIENTE' || evento.retiradoEm) throw eventoNaoRetiravel();
    if (evento.autorId !== ator.id && !temPermissao(ator.perfil, 'EQUIPE_GERENCIAR')) throw semPermissao();

    const resultado = await this.prisma.db.eventoOS.updateMany({
      where: { id: eventoId, ordemServicoId: osId, retiradoEm: null, tipo: 'ATUALIZACAO_CLIENTE' },
      data: { retiradoEm: new Date(), retiradoPorId: ator.id },
    });
    if (resultado.count === 0) throw eventoNaoRetiravel();

    const atualizado = await this.prisma.db.eventoOS.findUniqueOrThrow({ where: { id: eventoId }, select: CAMPOS_EVENTO });
    return paraDto(atualizado);
  }

  private async confirmarOs(osId: string): Promise<void> {
    const os = await this.prisma.db.ordemServico.findUnique({ where: { id: osId }, select: { id: true } });
    if (!os) throw osNaoEncontrada();
  }
}
