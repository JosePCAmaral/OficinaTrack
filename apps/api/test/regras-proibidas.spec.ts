import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath decodifica o "á" da pasta e trata o drive do Windows
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const PASTAS = ['api/src', 'web/src'].map((p) => join(RAIZ, p));
const PROIBIDOS: Array<[RegExp, string]> = [
  [/\$queryRawUnsafe|\$executeRawUnsafe/, 'SQL cru sem parâmetros (T6)'],
  [/dangerouslySetInnerHTML/, 'HTML sem escape (T6)'],
  [/console\.log\(/, 'use o Logger do Nest / sem logs no front'],
];

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (nome === 'generated' || nome === 'node_modules') return [];
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe('padrões proibidos no código', () => {
  const todos = PASTAS.flatMap(arquivos);

  it('encontra arquivos para verificar', () => {
    expect(todos.length).toBeGreaterThan(5);
  });

  it.each(PROIBIDOS)('não usa %s', (padrao, motivo) => {
    const violacoes = todos.filter((f) => padrao.test(readFileSync(f, 'utf8')));
    // O segundo argumento de `expect` é a mensagem exibida quando o teste falha
    // (qual padrão proibido foi encontrado), suportado pelo Vitest.
    // oxlint-disable-next-line vitest/valid-expect
    expect(violacoes, motivo).toEqual([]);
  });
});
