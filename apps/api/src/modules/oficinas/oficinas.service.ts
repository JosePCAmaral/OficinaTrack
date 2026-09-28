import { Injectable } from '@nestjs/common';
import { temPermissao, VERSAO_TERMOS, type DadosOficinaValidos, type PerfilUsuario } from '@oficinatrack/shared';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const CAMPOS = { id: true, nome: true, telefone: true, endereco: true, cidade: true, uf: true, documento: true } as const;

@Injectable()
export class OficinasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Oficina do contexto atual (a extensão filtra `Oficina` por id). */
  buscarAtual() {
    return this.prisma.db.oficina.findFirstOrThrow({ select: CAMPOS });
  }

  /**
   * Para `GET /oficinas/atual`: quem não edita a oficina não recebe o CPF/CNPJ (em MEI é o CPF do
   * dono; minimização LGPD, auditoria #9).
   */
  async buscarParaUsuario(perfil: PerfilUsuario) {
    const oficina = await this.buscarAtual();
    return temPermissao(perfil, 'OFICINA_EDITAR') ? oficina : { ...oficina, documento: null };
  }

  /**
   * Trava a linha da oficina até o commit (`UPDATE … increment`): aberturas simultâneas esperam
   * umas pelas outras e recebem números seguidos, sem buraco nem repetição.
   */
  async reservarNumeroOS(tx: Tx): Promise<number> {
    const { id } = await tx.oficina.findFirstOrThrow({ select: { id: true } });
    const { proximoNumeroOS } = await tx.oficina.update({
      where: { id },
      data: { proximoNumeroOS: { increment: 1 } },
      select: { proximoNumeroOS: true },
    });
    return proximoNumeroOS - 1;
  }

  criar(db: Db | Tx, dados: DadosOficinaValidos) {
    return db.oficina.create({ data: { ...dados, termosVersao: VERSAO_TERMOS, termosAceitosEm: new Date() }, select: CAMPOS });
  }

  async atualizar(dados: DadosOficinaValidos) {
    const atual = await this.buscarAtual();
    return this.prisma.db.oficina.update({
      where: { id: atual.id },
      data: { ...dados, endereco: dados.endereco ?? null, cidade: dados.cidade ?? null, uf: dados.uf ?? null, documento: dados.documento ?? null },
      select: CAMPOS,
    });
  }
}
