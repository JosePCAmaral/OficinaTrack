import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, type App } from '../auth/apoio-auth.js';
import { telefoneTeste } from '../telefone-teste.js';
import { auth, placaUnica } from './apoio-os.js';

type Resumo = { id: string; numero: number };

describe('Consultar e alterar OS', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  const abrir = (token: string, corpo: Record<string, unknown>) => ctx.http.post('/api/v1/ordens-servico').set(auth(token)).send(corpo).expect(201);
  const nova = (token: string, extra: Record<string, unknown> = {}) =>
    abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Revisão geral', ...extra });

  async function oficinaLogada(perfil: 'DONO' | 'FUNCIONARIO' = 'DONO') {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx, perfil);
    const { accessToken } = await entrar(ctx, usuario.email);
    return { oficina, usuario, token: accessToken };
  }

  it('GET /ordens-servico?situacao=abertas: mais recentes primeiro, sem entregues/canceladas, com resumo', async () => {
    const { oficina, token } = await oficinaLogada();
    const os1 = await nova(token, { nomeCliente: 'Ana' });
    const os2 = await nova(token);
    const os3 = await nova(token);
    const entregue = await nova(token);
    const cancelada = await nova(token);
    await ctx.tenant.executarComo(oficina.id, async () => {
      await ctx.prisma.db.ordemServico.update({ where: { id: entregue.body.id }, data: { status: 'ENTREGUE' } });
      await ctx.prisma.db.ordemServico.update({ where: { id: cancelada.body.id }, data: { status: 'CANCELADO' } });
    });

    const r = await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'abertas' }).set(auth(token)).expect(200);
    expect(r.body.itens.map((o: Resumo) => o.numero)).toEqual([3, 2, 1]);
    expect(r.body.proximoCursor).toBeNull();
    expect(r.body.itens[2]).toEqual({
      id: os1.body.id, numero: 1, status: 'TRIAGEM', statusDesde: os1.body.statusDesde, criadoEm: os1.body.criadoEm,
      placa: os1.body.veiculo.placa, modelo: null, cliente: { id: os1.body.cliente.id, nome: 'Ana' }, relatoCliente: 'Revisão geral',
    });
    expect([os2.body.id, os3.body.id]).toEqual(r.body.itens.slice(0, 2).map((o: Resumo) => o.id).toReversed());

    // sem `situacao` também lista as abertas (único filtro desta sprint)
    const padrao = await ctx.http.get('/api/v1/ordens-servico').set(auth(token)).expect(200);
    expect(padrao.body.itens.map((o: Resumo) => o.numero)).toEqual([3, 2, 1]);
  });

  it('paginação: limite=2 → proximoCursor, segunda página sem repetir; limite=51 → 400', async () => {
    const { token } = await oficinaLogada();
    for (let i = 0; i < 5; i++) await nova(token);

    const p1 = await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'abertas', limite: 2 }).set(auth(token)).expect(200);
    expect(p1.body.itens.map((o: Resumo) => o.numero)).toEqual([5, 4]);
    expect(p1.body.proximoCursor).toBe(p1.body.itens[1].id);
    const p2 = await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'abertas', limite: 2, cursor: p1.body.proximoCursor }).set(auth(token)).expect(200);
    expect(p2.body.itens.map((o: Resumo) => o.numero)).toEqual([3, 2]);
    const p3 = await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'abertas', limite: 2, cursor: p2.body.proximoCursor }).set(auth(token)).expect(200);
    expect(p3.body.itens.map((o: Resumo) => o.numero)).toEqual([1]);
    expect(p3.body.proximoCursor).toBeNull();

    const excesso = await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'abertas', limite: 51 }).set(auth(token)).expect(400);
    expect(excesso.body.code).toBe('VALIDACAO_FALHOU');
    await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'todas' }).set(auth(token)).expect(400);
  });

  it('GET /ordens-servico/:id devolve o detalhe; id inexistente → 404', async () => {
    const { token } = await oficinaLogada();
    const os = await nova(token, { kmEntrada: 1234, previsaoEntrega: '2026-10-02' });
    const r = await ctx.http.get(`/api/v1/ordens-servico/${os.body.id}`).set(auth(token)).expect(200);
    expect(r.body).toEqual(os.body);
    expect(r.body).toMatchObject({ kmEntrada: 1234, previsaoEntrega: '2026-10-02' });
    expect(r.body.veiculo).toEqual({ id: os.body.veiculo.id, placa: os.body.veiculo.placa, marca: null, modelo: null, cor: null, anoModelo: null });

    const inexistente = await ctx.http.get('/api/v1/ordens-servico/nao-existe').set(auth(token)).expect(404);
    expect(inexistente.body.code).toBe('RECURSO_NAO_ENCONTRADO');
  });

  it('PATCH: diagnóstico, previsão volta igual, responsável, km; limpar com string vazia', async () => {
    const { oficina, token } = await oficinaLogada();
    const funcionario = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const os = await nova(token, { kmEntrada: 1000 });
    const url = `/api/v1/ordens-servico/${os.body.id}`;

    const r1 = await ctx.http.patch(url).set(auth(token)).send({
      diagnostico: 'Pastilha gasta', previsaoEntrega: '2026-10-02', responsavelId: funcionario.id, kmEntrada: 2000, relatoCliente: 'Freio chiando',
    }).expect(200);
    expect(r1.body).toMatchObject({
      diagnostico: 'Pastilha gasta', previsaoEntrega: '2026-10-02', responsavel: { id: funcionario.id, nome: funcionario.nome },
      kmEntrada: 2000, relatoCliente: 'Freio chiando', status: 'TRIAGEM',
    });
    const guardada = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.ordemServico.findUnique({ where: { id: os.body.id } }));
    expect(guardada?.previsaoEntrega?.toISOString()).toBe('2026-10-02T15:00:00.000Z');
    const veiculo = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.veiculo.findUnique({ where: { id: os.body.veiculo.id } }));
    expect(veiculo?.kmAtual).toBe(2000);

    // km menor na OS não reduz o do veículo
    await ctx.http.patch(url).set(auth(token)).send({ kmEntrada: 500 }).expect(200);
    const depois = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.veiculo.findUnique({ where: { id: os.body.veiculo.id } }));
    expect(depois?.kmAtual).toBe(2000);

    const limpo = await ctx.http.patch(url).set(auth(token)).send({ diagnostico: '', previsaoEntrega: '', responsavelId: '', kmEntrada: '' }).expect(200);
    expect(limpo.body).toMatchObject({ diagnostico: null, previsaoEntrega: null, responsavel: null, kmEntrada: null });
  });

  it('PATCH: responsável inválido → 422 e nada muda; corpo vazio → 400', async () => {
    const { oficina, token } = await oficinaLogada();
    const outra = await criarOficinaComUsuario(ctx);
    const inativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { ativo: false });
    const os = await nova(token);
    const url = `/api/v1/ordens-servico/${os.body.id}`;

    for (const responsavelId of [outra.usuario.id, inativo.id]) {
      const r = await ctx.http.patch(url).set(auth(token)).send({ responsavelId, diagnostico: 'Não deve gravar' }).expect(422);
      expect(r.body.code).toBe('RESPONSAVEL_INVALIDO');
    }
    const intacta = await ctx.http.get(url).set(auth(token)).expect(200);
    expect(intacta.body).toMatchObject({ diagnostico: null, responsavel: null });

    const vazio = await ctx.http.patch(url).set(auth(token)).send({}).expect(400);
    expect(vazio.body.code).toBe('VALIDACAO_FALHOU');
  });

  it('PATCH: responsável desativado depois de atribuído não bloqueia editar a OS reenviando o mesmo responsavelId', async () => {
    const { oficina, token } = await oficinaLogada();
    const funcionario = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const outroInativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { ativo: false });
    const outra = await criarOficinaComUsuario(ctx);
    const os = await nova(token, { responsavelId: funcionario.id });
    const url = `/api/v1/ordens-servico/${os.body.id}`;
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.usuario.update({ where: { id: funcionario.id }, data: { ativo: false } }));

    const r = await ctx.http.patch(url).set(auth(token)).send({ diagnostico: 'Correia gasta', responsavelId: funcionario.id }).expect(200);
    expect(r.body).toMatchObject({ diagnostico: 'Correia gasta', responsavel: { id: funcionario.id } });

    // trocar para outro inativo ou para usuário de outra oficina continua recusado
    for (const responsavelId of [outroInativo.id, outra.usuario.id]) {
      const recusado = await ctx.http.patch(url).set(auth(token)).send({ responsavelId, diagnostico: 'Não deve gravar' }).expect(422);
      expect(recusado.body.code).toBe('RESPONSAVEL_INVALIDO');
    }
    const intacta = await ctx.http.get(url).set(auth(token)).expect(200);
    expect(intacta.body).toMatchObject({ diagnostico: 'Correia gasta', responsavel: { id: funcionario.id } });
  });

  it('históricos por veículo e por cliente, com paginação', async () => {
    const { oficina, token } = await oficinaLogada();
    const placa = placaUnica();
    const telefone = telefoneTeste();
    const a = await nova(token, { placa, telefone });
    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.ordemServico.update({ where: { id: a.body.id }, data: { status: 'ENTREGUE' } }));
    const b = await nova(token, { placa, telefone });
    const outroCarro = await nova(token, { telefone });
    await nova(token); // outro cliente, outro carro

    const porVeiculo = await ctx.http.get(`/api/v1/veiculos/${a.body.veiculo.id}/ordens-servico`).set(auth(token)).expect(200);
    expect(porVeiculo.body.itens.map((o: Resumo) => o.id)).toEqual([b.body.id, a.body.id]);

    const porCliente = await ctx.http.get(`/api/v1/clientes/${a.body.cliente.id}/ordens-servico`).set(auth(token)).expect(200);
    expect(porCliente.body.itens.map((o: Resumo) => o.id)).toEqual([outroCarro.body.id, b.body.id, a.body.id]);

    const pagina = await ctx.http.get(`/api/v1/clientes/${a.body.cliente.id}/ordens-servico`).query({ limite: 1 }).set(auth(token)).expect(200);
    expect(pagina.body.itens).toHaveLength(1);
    expect(pagina.body.proximoCursor).toBe(outroCarro.body.id);

    await ctx.http.get('/api/v1/veiculos/nao-existe/ordens-servico').set(auth(token)).expect(404);
    await ctx.http.get('/api/v1/clientes/nao-existe/ordens-servico').set(auth(token)).expect(404);
  });

  it('consulta de placa traz a OS aberta; rota única, não capturada por /veiculos/:id', async () => {
    const { oficina, token } = await oficinaLogada('FUNCIONARIO');
    const placa = placaUnica();
    const os = await nova(token, { placa, nomeCliente: 'Dono' });

    const r = await ctx.http.get('/api/v1/veiculos/consulta').query({ placa: placa.toLowerCase() }).set(auth(token)).expect(200);
    expect(r.body).toMatchObject({
      veiculo: { id: os.body.veiculo.id, placa, cliente: { id: os.body.cliente.id, nome: 'Dono' } },
      osAberta: { id: os.body.id, numero: 1, criadoEm: os.body.criadoEm },
    });

    await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.ordemServico.update({ where: { id: os.body.id }, data: { status: 'ENTREGUE' } }));
    const semAberta = await ctx.http.get('/api/v1/veiculos/consulta').query({ placa }).set(auth(token)).expect(200);
    expect(semAberta.body.osAberta).toBeNull();

    // sem placa: é a validação da consulta que responde (400), não a ficha do veículo "consulta" (404)
    const semPlaca = await ctx.http.get('/api/v1/veiculos/consulta').set(auth(token)).expect(400);
    expect(semPlaca.body.code).toBe('VALIDACAO_FALHOU');
  });

  it('sem login → 401 nas listas e no detalhe', async () => {
    await ctx.http.get('/api/v1/ordens-servico').expect(401);
    await ctx.http.get('/api/v1/ordens-servico/qualquer').expect(401);
  });
});
