process.env.FATOR_LIMITES = '1';
const { criarApp, criarOficinaComUsuario } = await import('./apoio-auth.js');

describe('Limites de tentativa de login', () => {
  it('5 senhas erradas para o mesmo e-mail bloqueiam a 6ª tentativa, mesmo com a senha certa', async () => {
    const ctx = await criarApp();
    try {
      const { usuario } = await criarOficinaComUsuario(ctx);
      for (let i = 0; i < 5; i++) {
        await ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: 'errada-errada' }).expect((r) => expect([401, 429]).toContain(r.status));
      }
      const r = await ctx.http.post('/api/v1/auth/login').send({ identificador: usuario.email, senha: 'motor-v8-turbo' });
      expect(r.status).toBe(429);
      expect(['MUITAS_TENTATIVAS', 'MUITAS_REQUISICOES']).toContain(r.body.code);
    } finally {
      await ctx.app.close();
    }
  });
});
