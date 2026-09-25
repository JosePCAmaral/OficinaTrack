import { Injectable } from '@nestjs/common';
import type { DadosOficinaValidos } from '@oficinatrack/shared';
import { VERSAO_TERMOS } from '@oficinatrack/shared';
import { PrismaService, type Db, type Tx } from '../../prisma/prisma.service.js';

const CAMPOS = { id: true, nome: true, telefone: true, endereco: true, cidade: true, uf: true, documento: true } as const;

@Injectable()
export class OficinasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Oficina do contexto atual (a extensão filtra `Oficina` por id). */
  buscarAtual() {
    return this.prisma.db.oficina.findFirstOrThrow({ select: CAMPOS });
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
