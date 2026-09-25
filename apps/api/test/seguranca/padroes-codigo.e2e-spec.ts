/**
 * Varredura estática de padrões que furam os controles de T1/T6. Complementa
 * `test/regras-proibidas.spec.ts` (que cobre $queryRawUnsafe, dangerouslySetInnerHTML
 * e console.log). Passa hoje; existe para pegar regressões a partir da Sprint 2.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const API_SRC = join(RAIZ, 'apps', 'api', 'src');
const SHARED_SRC = join(RAIZ, 'packages', 'shared', 'src');

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (nome === 'generated' || nome === 'node_modules') return [];
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) && !/\.spec\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const rel = (f: string) => relative(RAIZ, f).split(sep).join('/');
const codigoApi = arquivos(API_SRC);

function violacoes(lista: string[], padrao: RegExp, permitidos: string[] = []): string[] {
  return lista.filter((f) => !permitidos.includes(rel(f)) && padrao.test(readFileSync(f, 'utf8'))).map(rel);
}

describe('padrões de código que furam o isolamento (T1/T6)', () => {
  it('encontra o código da API', () => {
    expect(codigoApi.length).toBeGreaterThan(5);
  });

  // SQL cru não passa pela extensão de tenant. Todo uso novo precisa entrar na lista
  // com revisão explícita e filtro manual por oficinaId.
  it('$queryRaw/$executeRaw só nos arquivos revisados', () => {
    expect(
      violacoes(codigoApi, /\$(queryRaw|executeRaw)\b/, ['apps/api/src/modules/saude/saude.controller.ts']),
    ).toEqual([]);
  });

  // O client sem extensão fica escondido dentro do PrismaService.
  it('ninguém cria PrismaClient nem usa o client base fora do PrismaService', () => {
    expect(violacoes(codigoApi, /new PrismaClient\b/, ['apps/api/src/prisma/prisma.service.ts'])).toEqual([]);
    expect(
      violacoes(codigoApi, /\.base\b|\[['"]base['"]\]/, ['apps/api/src/prisma/prisma.service.ts']),
    ).toEqual([]);
  });

  // oficinaId vem só do tenant context: nem controller nem DTO/schema de entrada o mencionam.
  it('controllers, DTOs e schemas compartilhados não recebem oficinaId', () => {
    const entradas = codigoApi.filter((f) => /\.controller\.ts$|[\\/]dto[\\/]|\.dto\.ts$/.test(f));
    expect(violacoes(entradas, /oficinaId/)).toEqual([]);
    expect(violacoes(arquivos(join(SHARED_SRC, 'schemas')), /oficinaId/)).toEqual([]);
  });

  // executarSemTenant é exceção: todo uso precisa de comentário logo acima justificando.
  it('todo executarSemTenant no código de produção tem comentário de justificativa', () => {
    const semJustificativa: string[] = [];
    for (const f of codigoApi) {
      if (rel(f) === 'apps/api/src/common/tenant/tenant-context.ts') continue;
      const linhas = readFileSync(f, 'utf8').split('\n');
      linhas.forEach((linha, i) => {
        if (!linha.includes('executarSemTenant(')) return;
        const acima = linhas.slice(Math.max(0, i - 3), i).join('\n');
        if (!/\/\/|\*/.test(acima)) semJustificativa.push(`${rel(f)}:${i + 1}`);
      });
    }
    expect(semJustificativa).toEqual([]);
  });
});
