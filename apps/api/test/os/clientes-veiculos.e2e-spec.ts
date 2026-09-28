import { criarApp, criarOficinaComUsuario, entrar, type App } from '../auth/apoio-auth.js';
import { auth, criarClienteNa, criarVeiculoNa, placaUnica } from './apoio-os.js';

describe('Clientes, veículos e busca', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  it('busca por placa em qualquer formato acha o mesmo veículo (Review Focus 1)', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const cliente = await criarClienteNa(ctx, oficina.id, { nome: 'João' });
    const placa = placaUnica(); // ex.: 'QWE1R23'
    await criarVeiculoNa(ctx, oficina.id, cliente.id, placa);
    const { accessToken } = await entrar(ctx, usuario.email);
    for (const q of [placa.toLowerCase(), `${placa.slice(0, 3)}-${placa.slice(3)}`, ` ${placa} `]) {
      const r = await ctx.http.get('/api/v1/busca').query({ q }).set(auth(accessToken)).expect(200);
      expect(r.body.veiculos.map((v: { placa: string }) => v.placa)).toEqual([placa]);
    }
  });

  it('busca por telefone com máscara e por trecho do nome', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const cliente = await criarClienteNa(ctx, oficina.id, { nome: 'Maria Aparecida' });
    const { accessToken } = await entrar(ctx, usuario.email);

    const tel = cliente.telefone; // +55439XXXXXXXXX
    const mascarado = `(${tel.slice(3, 5)}) ${tel.slice(5, 10)}-${tel.slice(10)}`;
    const porTelefone = await ctx.http.get('/api/v1/busca').query({ q: mascarado }).set(auth(accessToken)).expect(200);
    expect(porTelefone.body.clientes.map((c: { id: string }) => c.id)).toEqual([cliente.id]);

    const porNome = await ctx.http.get('/api/v1/busca').query({ q: 'apare' }).set(auth(accessToken)).expect(200);
    expect(porNome.body.clientes.map((c: { id: string }) => c.id)).toEqual([cliente.id]);
  });

  it('placa parcial acha veículos que começam com o trecho', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const cliente = await criarClienteNa(ctx, oficina.id, { nome: 'Zeca' });
    const placa = `QWE${placaUnica().slice(3)}`; // garante o prefixo 'QWE', resto aleatório
    await criarVeiculoNa(ctx, oficina.id, cliente.id, placa);
    const { accessToken } = await entrar(ctx, usuario.email);
    const r = await ctx.http.get('/api/v1/busca').query({ q: 'QWE' }).set(auth(accessToken)).expect(200);
    expect(r.body.veiculos.map((v: { placa: string }) => v.placa)).toEqual([placa]);
  });

  it('isolamento: busca, ficha e PATCH de cliente/veículo da oficina B → vazio/404 para A', async () => {
    const a = await criarOficinaComUsuario(ctx);
    const b = await criarOficinaComUsuario(ctx);
    const clienteB = await criarClienteNa(ctx, b.oficina.id, { nome: 'Cliente B' });
    const placaB = placaUnica();
    const veiculoB = await criarVeiculoNa(ctx, b.oficina.id, clienteB.id, placaB);
    const { accessToken } = await entrar(ctx, a.usuario.email);

    const buscaPlaca = await ctx.http.get('/api/v1/busca').query({ q: placaB }).set(auth(accessToken)).expect(200);
    expect(buscaPlaca.body.veiculos).toEqual([]);
    const buscaNome = await ctx.http.get('/api/v1/busca').query({ q: 'Cliente B' }).set(auth(accessToken)).expect(200);
    expect(buscaNome.body.clientes).toEqual([]);

    await ctx.http.get(`/api/v1/clientes/${clienteB.id}`).set(auth(accessToken)).expect(404);
    await ctx.http.patch(`/api/v1/clientes/${clienteB.id}`).set(auth(accessToken)).send({ nome: 'Hackeado' }).expect(404);
    await ctx.http.get(`/api/v1/veiculos/${veiculoB.id}`).set(auth(accessToken)).expect(404);
    await ctx.http.patch(`/api/v1/veiculos/${veiculoB.id}`).set(auth(accessToken)).send({ marca: 'Hackeado' }).expect(404);
    await ctx.http.get('/api/v1/veiculos/consulta').query({ placa: placaB }).set(auth(accessToken)).expect(404);

    const intacto = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.cliente.findUnique({ where: { id: clienteB.id } }));
    expect(intacto?.nome).toBe('Cliente B');
  });

  it('consulta por placa: desconhecida → 404; conhecida → veículo e dono', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const cliente = await criarClienteNa(ctx, oficina.id, { nome: 'Dono do carro' });
    const placa = placaUnica();
    await criarVeiculoNa(ctx, oficina.id, cliente.id, placa);
    const { accessToken } = await entrar(ctx, usuario.email);

    const desconhecida = await ctx.http.get('/api/v1/veiculos/consulta').query({ placa: placaUnica() }).set(auth(accessToken)).expect(404);
    expect(desconhecida.body.code).toBe('RECURSO_NAO_ENCONTRADO');

    const r = await ctx.http.get('/api/v1/veiculos/consulta').query({ placa }).set(auth(accessToken)).expect(200);
    expect(r.body).toMatchObject({ veiculo: { placa, cliente: { id: cliente.id, nome: 'Dono do carro' } }, osAberta: null });
  });

  it('PATCH cliente: telefone de outro cliente → 409 TELEFONE_JA_CADASTRADO; em outra oficina pode (Review Focus 5)', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const c1 = await criarClienteNa(ctx, oficina.id, { nome: 'Cliente 1' });
    const c2 = await criarClienteNa(ctx, oficina.id, { nome: 'Cliente 2' });
    const { accessToken } = await entrar(ctx, usuario.email);

    const conflito = await ctx.http.patch(`/api/v1/clientes/${c2.id}`).set(auth(accessToken)).send({ telefone: c1.telefone }).expect(409);
    expect(conflito.body.code).toBe('TELEFONE_JA_CADASTRADO');

    const outra = await criarOficinaComUsuario(ctx);
    const cOutra = await criarClienteNa(ctx, outra.oficina.id, { nome: 'Outro' });
    const dOutra = await entrar(ctx, outra.usuario.email);
    await ctx.http.patch(`/api/v1/clientes/${cOutra.id}`).set(auth(dOutra.accessToken)).send({ telefone: c1.telefone }).expect(200);
  });

  it('PATCH veículo: placa de outro veículo → 409 PLACA_JA_CADASTRADA; em outra oficina pode (Review Focus 5)', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const cliente = await criarClienteNa(ctx, oficina.id);
    const v1 = await criarVeiculoNa(ctx, oficina.id, cliente.id);
    const v2 = await criarVeiculoNa(ctx, oficina.id, cliente.id);
    const { accessToken } = await entrar(ctx, usuario.email);

    const conflito = await ctx.http.patch(`/api/v1/veiculos/${v2.id}`).set(auth(accessToken)).send({ placa: v1.placa }).expect(409);
    expect(conflito.body.code).toBe('PLACA_JA_CADASTRADA');

    const outra = await criarOficinaComUsuario(ctx);
    const cOutra = await criarClienteNa(ctx, outra.oficina.id);
    const vOutra = await criarVeiculoNa(ctx, outra.oficina.id, cOutra.id);
    const dOutra = await entrar(ctx, outra.usuario.email);
    await ctx.http.patch(`/api/v1/veiculos/${vOutra.id}`).set(auth(dOutra.accessToken)).send({ placa: v1.placa }).expect(200);
  });

  it('PATCH cliente: string vazia limpa nome/e-mail/observações', async () => {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx);
    const cliente = await criarClienteNa(ctx, oficina.id, { nome: 'Fulano' });
    await ctx.tenant.executarComo(oficina.id, () =>
      ctx.prisma.db.cliente.update({ where: { id: cliente.id }, data: { email: 'fulano@teste.local', observacoes: 'nota interna' } }),
    );
    const { accessToken } = await entrar(ctx, usuario.email);
    const r = await ctx.http.patch(`/api/v1/clientes/${cliente.id}`).set(auth(accessToken)).send({ nome: '', email: '', observacoes: '' }).expect(200);
    expect(r.body).toMatchObject({ nome: null, email: null, observacoes: null });
  });

  it('busca com 1 caractere → 400 VALIDACAO_FALHOU', async () => {
    const { usuario } = await criarOficinaComUsuario(ctx);
    const { accessToken } = await entrar(ctx, usuario.email);
    const r = await ctx.http.get('/api/v1/busca').query({ q: 'a' }).set(auth(accessToken)).expect(400);
    expect(r.body.code).toBe('VALIDACAO_FALHOU');
  });
});
