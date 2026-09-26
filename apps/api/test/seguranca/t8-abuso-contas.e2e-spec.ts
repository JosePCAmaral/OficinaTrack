import { AuthService } from '../../src/modules/auth/auth.service.js';
import { criarApp, criarOficinaComUsuario, entrar, sufixo, type App } from '../auth/apoio-auth.js';

/**
 * Auditoria Sprint 2 (docs/auditorias/2026-09-26-sprint-2.md): T8, abuso de envio de e-mail e de tentativas.
 * Cada teste liga os limites reais (FATOR_LIMITES=1) só durante as chamadas medidas e restaura depois.
 * Todos "[achado #N, corrigido]": falhavam antes da correção e agora a garantem.
 */
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function comLimitesReais<T>(fn: () => Promise<T>): Promise<T> {
  const anterior = process.env.FATOR_LIMITES;
  process.env.FATOR_LIMITES = '1';
  try {
    return await fn();
  } finally {
    process.env.FATOR_LIMITES = anterior;
  }
}

describe('T8: abuso nos fluxos de conta (auditoria Sprint 2)', () => {
  let ctx: App;
  beforeEach(async () => {
    ctx = await criarApp(); // app novo por teste: contadores do throttler zerados
  });
  afterEach(() => ctx.app.close());

  it('[achado #2, corrigido] uma oficina não dispara 30 e-mails de convite seguidos para endereços arbitrários', async () => {
    const { usuario: dono } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, dono.email);
    const status = await comLimitesReais(async () => {
      const lista: number[] = [];
      for (let i = 0; i < 30; i++) {
        const r = await ctx.http.post('/api/v1/convites').set(auth(d.accessToken)).send({ nome: 'Promoção imperdível', email: `spam-${i}-${sufixo()}@teste.local` });
        lista.push(r.status);
      }
      return lista;
    });
    // antes: 30 × 201 (só o limite global de 120/min por IP se aplicava)
    expect(status).toContain(429);
  });

  it('[achado #3, corrigido] "esqueci a senha" não manda mais de 3 e-mails por hora ao mesmo destinatário (independe do IP)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const servico = ctx.app.get(AuthService);
    // chamada direta ao service: simula pedidos vindos de IPs diferentes (o throttler é por IP)
    for (let i = 0; i < 6; i++) await servico.esqueciSenha(usuario.email).catch(() => undefined);
    await ctx.emails.aguardarPendentes(); // o envio roda depois da resposta (auditoria #11)
    const enviados = ctx.emails.enviados.filter((m) => m.para === usuario.email).length;
    expect(enviados).toBeLessThanOrEqual(3);
  });

  it('[achado #7, corrigido] troca de senha limita tentativas de "senha atual" (6ª errada seguida → 429)', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const d = await entrar(ctx, usuario.email);
    const status = await comLimitesReais(async () => {
      const lista: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await ctx.http.patch('/api/v1/auth/senha').set(auth(d.accessToken)).send({ senhaAtual: `chute-${i}-errado`, novaSenha: 'nova-senha-do-ze' });
        lista.push(r.status);
      }
      return lista;
    });
    // antes: 6 × 400 SENHA_ATUAL_INCORRETA (só o limite global de 120/min por IP)
    expect(status).toContain(429);
  });
});
