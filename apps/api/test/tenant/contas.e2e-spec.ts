import { randomBytes } from 'node:crypto';
import { iniciar, montarOficina, type Ctx } from '../seguranca/apoio.js';

const sufixo = () => randomBytes(6).toString('hex');

describe('Contas: TokenUsuario e CodigoPiloto', () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await iniciar();
  });
  afterAll(() => ctx.modulo.close());

  it('TokenUsuario é filtrado por oficina', async () => {
    const a = await montarOficina(ctx, `A-${sufixo()}`);
    const b = await montarOficina(ctx, `B-${sufixo()}`);
    const token = await ctx.tenant.executarComo(a.oficina.id, () =>
      ctx.prisma.db.tokenUsuario.create({
        data: { oficinaId: a.oficina.id, usuarioId: a.usuario.id, tipo: 'CONFIRMAR_EMAIL', tokenHash: sufixo(), expiraEm: new Date(Date.now() + 60_000) },
      }),
    );
    const visto = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.tokenUsuario.findUnique({ where: { id: token.id } }));
    expect(visto).toBeNull();
  });

  it('TokenUsuario não aceita usuário de outra oficina (FK composta)', async () => {
    const a = await montarOficina(ctx, `A-${sufixo()}`);
    const b = await montarOficina(ctx, `B-${sufixo()}`);
    await expect(
      ctx.tenant.executarComo(a.oficina.id, () =>
        ctx.prisma.db.tokenUsuario.create({
          data: { oficinaId: a.oficina.id, usuarioId: b.usuario.id, tipo: 'REDEFINIR_SENHA', tokenHash: sufixo(), expiraEm: new Date() },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('CodigoPiloto é global: acessível sem tenant e fora de qualquer oficina', async () => {
    // sem tenant: códigos de piloto são do administrador, não de uma oficina
    const codigo = await ctx.tenant.executarSemTenant(() =>
      ctx.prisma.db.codigoPiloto.create({ data: { codigoHash: sufixo(), descricao: 'teste', expiraEm: new Date(Date.now() + 60_000) } }),
    );
    expect(codigo.usadoEm).toBeNull();
  });

  it('Usuario exige e-mail', async () => {
    const a = await montarOficina(ctx, `A-${sufixo()}`);
    await expect(
      ctx.tenant.executarComo(a.oficina.id, () =>
        // @ts-expect-error e-mail agora é obrigatório
        ctx.prisma.db.usuario.create({ data: { oficinaId: a.oficina.id, nome: 'Sem email', senhaHash: 'x', perfil: 'FUNCIONARIO' } }),
      ),
    ).rejects.toThrow();
  });
});
