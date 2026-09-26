import { ErroNegocio } from '../../common/erros/erro-negocio.js';
import { chaveBloqueio } from './auth.service.js';
import { JANELA_MS, LimiteTentativasService, MAX_FALHAS } from './limite-tentativas.service.js';

const falharVezes = (s: LimiteTentativasService, chave: string, n: number) => {
  for (let i = 0; i < n; i++) s.registrarFalha(chave);
};
const codigo = (fn: () => void) => {
  try {
    fn();
    return null;
  } catch (erro) {
    return erro instanceof ErroNegocio ? { status: erro.getStatus(), code: erro.code } : erro;
  }
};

describe('LimiteTentativasService', () => {
  let limites: LimiteTentativasService;
  beforeEach(() => {
    vi.useFakeTimers();
    limites = new LimiteTentativasService();
  });
  afterEach(() => vi.useRealTimers());

  it('verificar passa sem falhas e até a 4ª falha; na 5ª bloqueia com 429 MUITAS_TENTATIVAS', () => {
    expect(codigo(() => limites.verificar('a'))).toBeNull();
    falharVezes(limites, 'a', MAX_FALHAS - 1);
    expect(codigo(() => limites.verificar('a'))).toBeNull();
    limites.registrarFalha('a');
    expect(codigo(() => limites.verificar('a'))).toEqual({ status: 429, code: 'MUITAS_TENTATIVAS' });
  });

  it('as chaves são independentes', () => {
    falharVezes(limites, 'a', MAX_FALHAS);
    expect(codigo(() => limites.verificar('b'))).toBeNull();
  });

  it('limpar zera o contador (login certo antes do bloqueio)', () => {
    falharVezes(limites, 'a', MAX_FALHAS);
    limites.limpar('a');
    expect(codigo(() => limites.verificar('a'))).toBeNull();
  });

  it('a janela de 15 min expira: depois dela o bloqueio cai e a contagem recomeça', () => {
    falharVezes(limites, 'a', MAX_FALHAS);
    vi.advanceTimersByTime(JANELA_MS);
    expect(codigo(() => limites.verificar('a'))).not.toBeNull(); // no limite exato ainda vale
    vi.advanceTimersByTime(1);
    expect(codigo(() => limites.verificar('a'))).toBeNull();
    falharVezes(limites, 'a', MAX_FALHAS - 1);
    expect(codigo(() => limites.verificar('a'))).toBeNull();
  });

  it('falha registrada depois da janela recomeça do 1', () => {
    falharVezes(limites, 'a', MAX_FALHAS - 1);
    vi.advanceTimersByTime(JANELA_MS + 1);
    limites.registrarFalha('a');
    expect(codigo(() => limites.verificar('a'))).toBeNull();
  });

  it('não multiplica por FATOR_LIMITES: o bloqueio é por conta, não por IP', () => {
    const anterior = process.env.FATOR_LIMITES;
    process.env.FATOR_LIMITES = '100';
    try {
      falharVezes(limites, 'a', MAX_FALHAS);
      expect(codigo(() => limites.verificar('a'))).toEqual({ status: 429, code: 'MUITAS_TENTATIVAS' });
    } finally {
      process.env.FATOR_LIMITES = anterior;
    }
  });

  it('chaveBloqueio: a conta quando existe (e-mail e telefone somam), senão o identificador', () => {
    expect(chaveBloqueio('u1', 'ze@x.com')).toBe(chaveBloqueio('u1', '+5543999998888'));
    expect(chaveBloqueio(undefined, 'ze@x.com')).not.toBe(chaveBloqueio(undefined, '+5543999998888'));
    expect(chaveBloqueio(undefined, 'u1')).not.toBe(chaveBloqueio('u1', 'x'));
  });
});
