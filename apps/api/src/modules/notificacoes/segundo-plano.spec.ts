import { Logger } from '@nestjs/common';
import { SegundoPlano } from './segundo-plano.js';

describe('SegundoPlano', () => {
  afterEach(() => vi.restoreAllMocks());

  it('não bloqueia quem chama e aguardar() espera as tarefas, inclusive as encadeadas', async () => {
    const plano = new SegundoPlano();
    const feito: string[] = [];
    plano.executar('falha', async () => {
      await new Promise((r) => setTimeout(r, 10));
      feito.push('a');
      plano.executar('falha', async () => {
        feito.push('b');
      });
    });
    expect(feito).toEqual([]);
    await plano.aguardar();
    expect(feito).toEqual(['a', 'b']);
  });

  it('erro vira log só com o nome do erro (nada da mensagem, que pode ter dados pessoais)', async () => {
    const logs: string[] = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((msg: unknown) => void logs.push(String(msg)));
    const plano = new SegundoPlano();
    plano.executar('Falha ao enviar', async () => {
      throw new TypeError('ze@oficina.com +5543999998888');
    });
    await plano.aguardar();
    expect(logs).toEqual(['Falha ao enviar: TypeError']);
  });
});
