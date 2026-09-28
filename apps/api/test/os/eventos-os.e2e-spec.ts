import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, type App } from '../auth/apoio-auth.js';
import { telefoneTeste } from '../telefone-teste.js';
import { auth, placaUnica } from './apoio-os.js';

type Evento = { id: string; tipo: string; texto: string | null; visivelCliente: boolean; retiradoEm: string | null; retiradoPor: { id: string; nome: string } | null; autor: { id: string; nome: string } | null };

describe('Eventos da OS', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  async function oficinaLogada(perfil: 'DONO' | 'FUNCIONARIO' = 'DONO') {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx, perfil);
    const { accessToken } = await entrar(ctx, usuario.email);
    return { oficina, usuario, token: accessToken };
  }

  async function abrirOs(token: string, relatoCliente = 'Revisão geral') {
    const r = await ctx.http
      .post('/api/v1/ordens-servico')
      .set(auth(token))
      .send({ placa: placaUnica(), telefone: telefoneTeste(), relatoCliente })
      .expect(201);
    return r.body as { id: string };
  }

  const rota = (osId: string) => `/api/v1/ordens-servico/${osId}/eventos`;
  const publicar = (token: string, osId: string, corpo: Record<string, unknown>) => ctx.http.post(rota(osId)).set(auth(token)).send(corpo);
  const listar = (token: string, osId: string, query: Record<string, unknown> = {}) => ctx.http.get(rota(osId)).query(query).set(auth(token));
  const retirar = (token: string, osId: string, eventoId: string) => ctx.http.post(`${rota(osId)}/${eventoId}/retirar`).set(auth(token)).send();

  it('publica nota interna (visivelCliente=false) e atualização (visivelCliente=true), listadas da mais nova para a mais antiga', async () => {
    const { usuario, token } = await oficinaLogada();
    const os = await abrirOs(token);

    const nota = await publicar(token, os.id, { tipo: 'NOTA_INTERNA', texto: 'Verificar amortecedor traseiro' }).expect(201);
    expect(nota.body).toMatchObject({
      tipo: 'NOTA_INTERNA', texto: 'Verificar amortecedor traseiro', visivelCliente: false,
      autor: { id: usuario.id, nome: usuario.nome }, retiradoEm: null, retiradoPor: null,
    });
    expect(typeof nota.body.id).toBe('string');
    expect(new Date(nota.body.criadoEm).toISOString()).toBe(nota.body.criadoEm);

    const atualizacao = await publicar(token, os.id, { tipo: 'ATUALIZACAO_CLIENTE', texto: 'Seu carro está pronto para retirada' }).expect(201);
    expect(atualizacao.body).toMatchObject({
      tipo: 'ATUALIZACAO_CLIENTE', texto: 'Seu carro está pronto para retirada', visivelCliente: true,
      autor: { id: usuario.id, nome: usuario.nome },
    });

    const lista = await listar(token, os.id).expect(200);
    expect(lista.body.itens.map((e: Evento) => e.tipo)).toEqual(['ATUALIZACAO_CLIENTE', 'NOTA_INTERNA', 'OS_ABERTA']);
    expect(lista.body.itens.map((e: Evento) => e.id)).toEqual([atualizacao.body.id, nota.body.id, expect.any(String)]);
    expect(lista.body.proximoCursor).toBeNull();
  });

  it('body com visivelCliente=true numa NOTA_INTERNA continua false (Review Focus 4)', async () => {
    const { token } = await oficinaLogada();
    const os = await abrirOs(token);

    const r = await publicar(token, os.id, { tipo: 'NOTA_INTERNA', texto: 'Anotação interna', visivelCliente: true }).expect(201);
    expect(r.body.visivelCliente).toBe(false);

    const persistido = await listar(token, os.id).expect(200);
    const evento = persistido.body.itens.find((e: Evento) => e.id === r.body.id);
    expect(evento.visivelCliente).toBe(false);
  });

  it('tipo COMENTARIO, OS_ABERTA ou VEICULO_TRANSFERIDO no body → 400', async () => {
    const { token } = await oficinaLogada();
    const os = await abrirOs(token);

    for (const tipo of ['COMENTARIO', 'OS_ABERTA', 'VEICULO_TRANSFERIDO']) {
      const r = await publicar(token, os.id, { tipo, texto: 'Tentativa' }).expect(400);
      expect(r.body.code).toBe('VALIDACAO_FALHOU');
    }
  });

  it('autor retira a própria atualização: retiradoEm e retiradoPor preenchidos, visivelCliente inalterado', async () => {
    const { usuario, token } = await oficinaLogada();
    const os = await abrirOs(token);
    const atualizacao = await publicar(token, os.id, { tipo: 'ATUALIZACAO_CLIENTE', texto: 'Aguardando peça' }).expect(201);

    const r = await retirar(token, os.id, atualizacao.body.id).expect(200);
    expect(r.body.visivelCliente).toBe(true);
    expect(r.body.retiradoEm).not.toBeNull();
    expect(new Date(r.body.retiradoEm).toISOString()).toBe(r.body.retiradoEm);
    expect(r.body.retiradoPor).toEqual({ id: usuario.id, nome: usuario.nome });
  });

  it('outro FUNCIONARIO não retira a atualização alheia → 403; o DONO retira', async () => {
    const { oficina, usuario: dono, token: tokenDono } = await oficinaLogada('DONO');
    const autor = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const outro = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const { accessToken: tokenAutor } = await entrar(ctx, autor.email);
    const { accessToken: tokenOutro } = await entrar(ctx, outro.email);

    const os = await abrirOs(tokenDono);
    const atualizacao = await publicar(tokenAutor, os.id, { tipo: 'ATUALIZACAO_CLIENTE', texto: 'Trocando pastilhas' }).expect(201);

    const negado = await retirar(tokenOutro, os.id, atualizacao.body.id).expect(403);
    expect(negado.body.code).toBe('SEM_PERMISSAO');

    const r = await retirar(tokenDono, os.id, atualizacao.body.id).expect(200);
    expect(r.body.retiradoPor).toEqual({ id: dono.id, nome: dono.nome });
  });

  it('retirar nota interna → 422; retirar de novo → 422 (Review Focus 4)', async () => {
    const { token } = await oficinaLogada();
    const os = await abrirOs(token);

    const nota = await publicar(token, os.id, { tipo: 'NOTA_INTERNA', texto: 'Só interno' }).expect(201);
    const r1 = await retirar(token, os.id, nota.body.id).expect(422);
    expect(r1.body.code).toBe('EVENTO_NAO_RETIRAVEL');

    const atualizacao = await publicar(token, os.id, { tipo: 'ATUALIZACAO_CLIENTE', texto: 'Pronto' }).expect(201);
    await retirar(token, os.id, atualizacao.body.id).expect(200);
    const r2 = await retirar(token, os.id, atualizacao.body.id).expect(422);
    expect(r2.body.code).toBe('EVENTO_NAO_RETIRAVEL');
  });

  it('evento de outra OS na mesma oficina → 404', async () => {
    const { token } = await oficinaLogada();
    const os1 = await abrirOs(token);
    const os2 = await abrirOs(token);
    const evento = await publicar(token, os1.id, { tipo: 'ATUALIZACAO_CLIENTE', texto: 'Da primeira OS' }).expect(201);

    const getErrado = await listar(token, os2.id).expect(200);
    expect(getErrado.body.itens.map((e: Evento) => e.id)).not.toContain(evento.body.id);

    const r = await retirar(token, os2.id, evento.body.id).expect(404);
    expect(r.body.code).toBe('RECURSO_NAO_ENCONTRADO');
  });

  it('isolamento: listar/publicar/retirar na OS de B → 404 para A', async () => {
    const a = await oficinaLogada();
    const b = await oficinaLogada();
    const osB = await abrirOs(b.token);
    const eventoB = await publicar(b.token, osB.id, { tipo: 'ATUALIZACAO_CLIENTE', texto: 'Da oficina B' }).expect(201);

    const l = await listar(a.token, osB.id).expect(404);
    expect(l.body.code).toBe('RECURSO_NAO_ENCONTRADO');
    const p = await publicar(a.token, osB.id, { tipo: 'NOTA_INTERNA', texto: 'Invasão' }).expect(404);
    expect(p.body.code).toBe('RECURSO_NAO_ENCONTRADO');
    const rt = await retirar(a.token, osB.id, eventoB.body.id).expect(404);
    expect(rt.body.code).toBe('RECURSO_NAO_ENCONTRADO');

    const intacto = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.eventoOS.findUnique({ where: { id: eventoB.body.id } }));
    expect(intacto?.retiradoEm).toBeNull();
  });

  it('paginação dos eventos respeita o limite máximo', async () => {
    const { token } = await oficinaLogada();
    const os = await abrirOs(token);
    for (let i = 0; i < 5; i++) await publicar(token, os.id, { tipo: 'NOTA_INTERNA', texto: `Nota ${i}` }).expect(201);
    // 5 notas + 1 evento OS_ABERTA = 6 eventos

    const p1 = await listar(token, os.id, { limite: 2 }).expect(200);
    expect(p1.body.itens).toHaveLength(2);
    expect(p1.body.proximoCursor).toBe(p1.body.itens[1].id);

    const p2 = await listar(token, os.id, { limite: 2, cursor: p1.body.proximoCursor }).expect(200);
    expect(p2.body.itens).toHaveLength(2);
    expect(p2.body.itens.map((e: Evento) => e.id)).not.toEqual(expect.arrayContaining(p1.body.itens.map((e: Evento) => e.id)));

    const p3 = await listar(token, os.id, { limite: 2, cursor: p2.body.proximoCursor }).expect(200);
    expect(p3.body.itens).toHaveLength(2);
    expect(p3.body.proximoCursor).toBeNull();

    const excesso = await listar(token, os.id, { limite: 51 }).expect(400);
    expect(excesso.body.code).toBe('VALIDACAO_FALHOU');
  });
});
