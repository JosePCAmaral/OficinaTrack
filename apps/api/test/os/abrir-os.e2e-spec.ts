import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, type App } from '../auth/apoio-auth.js';
import { telefoneTeste } from '../telefone-teste.js';
import { auth, criarClienteNa, criarVeiculoNa, placaUnica } from './apoio-os.js';

/** `+55439XXXXXXXX` → `(43) 9XXXX-XXXX` */
const mascarar = (tel: string) => `(${tel.slice(3, 5)}) ${tel.slice(5, 10)}-${tel.slice(10)}`;
/** `+55439XXXXXXXX` → `+55 43 9XXXX-XXXX` */
const comEspacos = (tel: string) => `+55 ${tel.slice(3, 5)} ${tel.slice(5, 10)}-${tel.slice(10)}`;

describe('Abrir OS', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  const abrir = (token: string, corpo: Record<string, unknown>) => ctx.http.post('/api/v1/ordens-servico').set(auth(token)).send(corpo);

  async function oficinaLogada(perfil: 'DONO' | 'FUNCIONARIO' = 'DONO') {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx, perfil);
    const { accessToken } = await entrar(ctx, usuario.email);
    return { oficina, usuario, token: accessToken };
  }

  const eventosDa = (oficinaId: string, ordemServicoId: string) =>
    ctx.tenant.executarComo(oficinaId, () => ctx.prisma.db.eventoOS.findMany({ where: { ordemServicoId }, orderBy: { criadoEm: 'asc' } }));

  it('só placa + WhatsApp + queixa: cria cliente, veículo, OS #1 em TRIAGEM com evento OS_ABERTA', async () => {
    const { oficina, usuario, token } = await oficinaLogada();
    const placa = placaUnica();
    const telefone = telefoneTeste();

    const r = await abrir(token, { placa, telefone, relatoCliente: 'Barulho na suspensão' }).expect(201);
    expect(r.body).toMatchObject({
      numero: 1, status: 'TRIAGEM', relatoCliente: 'Barulho na suspensão', diagnostico: null, kmEntrada: null, previsaoEntrega: null,
      veiculo: { placa }, cliente: { telefone, nome: null }, responsavel: null,
    });
    expect(typeof r.body.id).toBe('string');
    expect(new Date(r.body.criadoEm).toISOString()).toBe(r.body.criadoEm);

    const eventos = await eventosDa(oficina.id, r.body.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: 'OS_ABERTA', visivelCliente: true, autorId: usuario.id });

    const veiculo = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.veiculo.findFirst({ where: { placa } }));
    expect(veiculo?.clienteId).toBe(r.body.cliente.id);
  });

  it('segunda OS da oficina recebe o número seguinte', async () => {
    const { token } = await oficinaLogada();
    const r1 = await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Troca de óleo' }).expect(201);
    const r2 = await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Freio' }).expect(201);
    expect([r1.body.numero, r2.body.numero]).toEqual([1, 2]);
  });

  it('reaproveita cliente pelo telefone e veículo pela placa em outro formato (Review Focus 1)', async () => {
    const { oficina, token } = await oficinaLogada();
    const placa = placaUnica();
    const telefone = telefoneTeste();

    const r1 = await abrir(token, {
      placa: `${placa.slice(0, 3)}-${placa.slice(3)}`.toLowerCase(), telefone: mascarar(telefone), relatoCliente: 'Primeira visita',
    }).expect(201);
    expect(r1.body.veiculo.placa).toBe(placa);
    expect(r1.body.cliente.telefone).toBe(telefone);

    await ctx.tenant.executarComo(oficina.id, () =>
      ctx.prisma.db.ordemServico.update({ where: { id: r1.body.id }, data: { status: 'ENTREGUE' } }),
    );

    const r2 = await abrir(token, { placa, telefone: comEspacos(telefone), relatoCliente: 'Voltou' }).expect(201);
    expect(r2.body.cliente.id).toBe(r1.body.cliente.id);
    expect(r2.body.veiculo.id).toBe(r1.body.veiculo.id);

    const contagem = await ctx.tenant.executarComo(oficina.id, async () => ({
      clientes: await ctx.prisma.db.cliente.count({ where: { telefone } }),
      veiculos: await ctx.prisma.db.veiculo.count({ where: { placa } }),
    }));
    expect(contagem).toEqual({ clientes: 1, veiculos: 1 });
  });

  it('nome informado completa cliente sem nome, mas não sobrescreve nome existente', async () => {
    const { oficina, token } = await oficinaLogada();
    const semNome = await criarClienteNa(ctx, oficina.id);
    const r1 = await abrir(token, { placa: placaUnica(), telefone: semNome.telefone, nomeCliente: 'Novo Nome', relatoCliente: 'Revisão' }).expect(201);
    expect(r1.body.cliente).toMatchObject({ id: semNome.id, nome: 'Novo Nome' });

    const comNome = await criarClienteNa(ctx, oficina.id, { nome: 'Nome Antigo' });
    const r2 = await abrir(token, { placa: placaUnica(), telefone: comNome.telefone, nomeCliente: 'Outro', relatoCliente: 'Revisão' }).expect(201);
    expect(r2.body.cliente).toMatchObject({ id: comNome.id, nome: 'Nome Antigo' });
  });

  it('D4: carro com OS aberta → 409 OS_ABERTA_EXISTENTE com id e número; criarMesmoComOsAberta → cria', async () => {
    const { oficina, token } = await oficinaLogada();
    const placa = placaUnica();
    const telefone = telefoneTeste();
    const primeira = await abrir(token, { placa, telefone, relatoCliente: 'Motor falhando' }).expect(201);

    const aviso = await abrir(token, { placa, telefone, relatoCliente: 'De novo' }).expect(409);
    expect(aviso.body).toMatchObject({
      statusCode: 409, code: 'OS_ABERTA_EXISTENTE', message: 'Este carro já está na OS #0001',
      details: { id: primeira.body.id, numero: 1, criadoEm: primeira.body.criadoEm },
    });
    const semNova = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.ordemServico.count());
    expect(semNova).toBe(1);

    const segunda = await abrir(token, { placa, telefone, relatoCliente: 'De novo', criarMesmoComOsAberta: true }).expect(201);
    expect(segunda.body).toMatchObject({ numero: 2, veiculo: { id: primeira.body.veiculo.id } });
  });

  it('D1: placa com outro dono → 409 VEICULO_DE_OUTRO_CLIENTE com nome e 4 últimos dígitos', async () => {
    const { oficina, token } = await oficinaLogada();
    const dono = await criarClienteNa(ctx, oficina.id, { nome: 'Dono Antigo' });
    const veiculo = await criarVeiculoNa(ctx, oficina.id, dono.id);
    const novoTelefone = telefoneTeste();

    const r = await abrir(token, { placa: veiculo.placa, telefone: novoTelefone, relatoCliente: 'Comprei este carro' }).expect(409);
    expect(r.body).toMatchObject({
      code: 'VEICULO_DE_OUTRO_CLIENTE',
      details: { dono: { nome: 'Dono Antigo', telefoneFinal: dono.telefone.slice(-4) } },
    });
    expect(JSON.stringify(r.body)).not.toContain(dono.telefone);
    expect(r.body.details.dono).not.toHaveProperty('id');

    const nada = await ctx.tenant.executarComo(oficina.id, async () => ({
      os: await ctx.prisma.db.ordemServico.count(),
      novoCliente: await ctx.prisma.db.cliente.count({ where: { telefone: novoTelefone } }),
    }));
    expect(nada).toEqual({ os: 0, novoCliente: 0 });
  });

  it('D1 transferir=true: veículo passa para o novo cliente e há evento interno VEICULO_TRANSFERIDO', async () => {
    const { oficina, usuario, token } = await oficinaLogada();
    const dono = await criarClienteNa(ctx, oficina.id, { nome: 'Dono Antigo' });
    const veiculo = await criarVeiculoNa(ctx, oficina.id, dono.id);

    const r = await abrir(token, {
      placa: veiculo.placa, telefone: telefoneTeste(), nomeCliente: 'Dona Nova', relatoCliente: 'Comprei', transferirVeiculo: true,
    }).expect(201);
    expect(r.body.cliente.nome).toBe('Dona Nova');
    expect(r.body.veiculo.id).toBe(veiculo.id);

    const atualizado = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.veiculo.findUnique({ where: { id: veiculo.id } }));
    expect(atualizado?.clienteId).toBe(r.body.cliente.id);

    const eventos = await eventosDa(oficina.id, r.body.id);
    expect(eventos.map((e) => e.tipo).toSorted()).toEqual(['OS_ABERTA', 'VEICULO_TRANSFERIDO']);
    const transferido = eventos.find((e) => e.tipo === 'VEICULO_TRANSFERIDO')!;
    expect(transferido).toMatchObject({ visivelCliente: false, autorId: usuario.id, texto: 'Veículo transferido de Dono Antigo para Dona Nova' });
  });

  it('D1 transferir=false: OS no nome de quem trouxe, veículo continua com o dono', async () => {
    const { oficina, token } = await oficinaLogada();
    const dono = await criarClienteNa(ctx, oficina.id, { nome: 'Dono' });
    const veiculo = await criarVeiculoNa(ctx, oficina.id, dono.id);
    const telefone = telefoneTeste();

    const r = await abrir(token, { placa: veiculo.placa, telefone, relatoCliente: 'Emprestado', transferirVeiculo: false }).expect(201);
    expect(r.body.cliente.telefone).toBe(telefone);
    expect(r.body.cliente.id).not.toBe(dono.id);
    expect(r.body.veiculo.id).toBe(veiculo.id);

    const intacto = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.veiculo.findUnique({ where: { id: veiculo.id } }));
    expect(intacto?.clienteId).toBe(dono.id);
    const eventos = await eventosDa(oficina.id, r.body.id);
    expect(eventos.map((e) => e.tipo)).toEqual(['OS_ABERTA']);
  });

  it('duas aberturas simultâneas recebem números distintos e consecutivos (Review Focus 2)', async () => {
    const { token } = await oficinaLogada();
    await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Primeira' }).expect(201);
    const respostas = await Promise.all([
      abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Simultânea A' }),
      abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Simultânea B' }),
      abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Simultânea C' }),
    ]);
    expect(respostas.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(respostas.map((r) => r.body.numero as number).toSorted((a, b) => a - b)).toEqual([2, 3, 4]);
  });

  it('mesmo telefone novo em duas aberturas simultâneas → um cliente só (Review Focus 2)', async () => {
    const { oficina, token } = await oficinaLogada();
    const telefone = telefoneTeste();
    const respostas = await Promise.all([
      abrir(token, { placa: placaUnica(), telefone, relatoCliente: 'Carro 1' }),
      abrir(token, { placa: placaUnica(), telefone, relatoCliente: 'Carro 2' }),
    ]);
    expect(respostas.map((r) => r.status)).toEqual([201, 201]);
    expect(respostas[0]!.body.cliente.id).toBe(respostas[1]!.body.cliente.id);
    expect(respostas.map((r) => r.body.numero as number).toSorted((a, b) => a - b)).toEqual([1, 2]);
    const clientes = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.cliente.count({ where: { telefone } }));
    expect(clientes).toBe(1);
  });

  it('D4 sob corrida: duas aberturas simultâneas do mesmo carro sem OS aberta → uma cria, a outra 409 OS_ABERTA_EXISTENTE', async () => {
    const { oficina, token } = await oficinaLogada();
    const dono = await criarClienteNa(ctx, oficina.id, { nome: 'Dono' });
    const veiculo = await criarVeiculoNa(ctx, oficina.id, dono.id);
    await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Outro carro' }).expect(201);

    const respostas = await Promise.all([
      abrir(token, { placa: veiculo.placa, telefone: dono.telefone, relatoCliente: 'Pedido 1' }),
      abrir(token, { placa: veiculo.placa, telefone: dono.telefone, relatoCliente: 'Pedido 2' }),
    ]);
    expect(respostas.map((r) => r.status).toSorted()).toEqual([201, 409]);
    const criada = respostas.find((r) => r.status === 201)!;
    const recusada = respostas.find((r) => r.status === 409)!;
    expect(recusada.body.code).toBe('OS_ABERTA_EXISTENTE');
    expect(recusada.body.details).toMatchObject({ id: criada.body.id, numero: criada.body.numero });
    // o número reservado pela abertura recusada volta com o rollback
    expect(criada.body.numero).toBe(2);
    await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Seguinte' }).expect(201).expect((r) => {
      expect(r.body.numero).toBe(3);
    });
    const oss = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.ordemServico.count({ where: { veiculoId: veiculo.id } }));
    expect(oss).toBe(1);
  });

  it('mesma placa nova em duas aberturas simultâneas → um veículo só (Review Focus 2)', async () => {
    const { oficina, token } = await oficinaLogada();
    const placa = placaUnica();
    const telefone = telefoneTeste();
    const respostas = await Promise.all([
      abrir(token, { placa, telefone, relatoCliente: 'Pedido 1', criarMesmoComOsAberta: true }),
      abrir(token, { placa, telefone, relatoCliente: 'Pedido 2', criarMesmoComOsAberta: true }),
    ]);
    expect(respostas.map((r) => r.status)).toEqual([201, 201]);
    expect(respostas[0]!.body.veiculo.id).toBe(respostas[1]!.body.veiculo.id);
    const veiculos = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.veiculo.count({ where: { placa } }));
    expect(veiculos).toBe(1);
  });

  it('responsável de outra oficina ou inativo → 422 RESPONSAVEL_INVALIDO', async () => {
    const { oficina, token } = await oficinaLogada();
    const outra = await criarOficinaComUsuario(ctx);
    const inativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO', { ativo: false });

    for (const responsavelId of [outra.usuario.id, inativo.id, 'nao-existe']) {
      const r = await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Revisão', responsavelId }).expect(422);
      expect(r.body.code).toBe('RESPONSAVEL_INVALIDO');
    }
    const nada = await ctx.tenant.executarComo(oficina.id, async () => ({
      os: await ctx.prisma.db.ordemServico.count(),
      clientes: await ctx.prisma.db.cliente.count(),
    }));
    expect(nada).toEqual({ os: 0, clientes: 0 });

    const ativo = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
    const ok = await abrir(token, {
      placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Revisão', responsavelId: ativo.id, previsaoEntrega: '2026-10-02',
    }).expect(201);
    expect(ok.body.responsavel).toEqual({ id: ativo.id, nome: ativo.nome });
    expect(ok.body.previsaoEntrega).toBe('2026-10-02');
  });

  it('km maior atualiza o veículo; km menor não', async () => {
    const { oficina, token } = await oficinaLogada();
    const placa = placaUnica();
    const telefone = telefoneTeste();
    const kmDoVeiculo = async () =>
      (await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.veiculo.findFirst({ where: { placa } })))?.kmAtual;

    await abrir(token, { placa, telefone, relatoCliente: 'Primeira', kmEntrada: 50_000 }).expect(201);
    expect(await kmDoVeiculo()).toBe(50_000);

    const maior = await abrir(token, { placa, telefone, relatoCliente: 'Segunda', kmEntrada: 60_000, criarMesmoComOsAberta: true }).expect(201);
    expect(maior.body.kmEntrada).toBe(60_000);
    expect(await kmDoVeiculo()).toBe(60_000);

    const menor = await abrir(token, { placa, telefone, relatoCliente: 'Terceira', kmEntrada: 10_000, criarMesmoComOsAberta: true }).expect(201);
    expect(menor.body.kmEntrada).toBe(10_000);
    expect(await kmDoVeiculo()).toBe(60_000);
  });

  it('validação: sem queixa ou com placa inválida → 400 VALIDACAO_FALHOU; oficinaId no corpo é ignorado', async () => {
    const { oficina, token } = await oficinaLogada();
    const semQueixa = await abrir(token, { placa: placaUnica(), telefone: telefoneTeste() }).expect(400);
    expect(semQueixa.body.code).toBe('VALIDACAO_FALHOU');
    await abrir(token, { placa: 'XX', telefone: telefoneTeste(), relatoCliente: 'Revisão' }).expect(400);

    const outra = await criarOficinaComUsuario(ctx);
    const r = await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Revisão', oficinaId: outra.oficina.id }).expect(201);
    const os = await ctx.tenant.executarComo(oficina.id, () => ctx.prisma.db.ordemServico.findUnique({ where: { id: r.body.id } }));
    expect(os?.oficinaId).toBe(oficina.id);
  });

  it('isolamento: GET/PATCH da OS de B → 404 para A; listas não mostram OS de B', async () => {
    const a = await oficinaLogada();
    const b = await oficinaLogada();
    const placaB = placaUnica();
    const osB = await abrir(b.token, { placa: placaB, telefone: telefoneTeste(), relatoCliente: 'Da oficina B' }).expect(201);

    const get = await ctx.http.get(`/api/v1/ordens-servico/${osB.body.id}`).set(auth(a.token)).expect(404);
    expect(get.body.code).toBe('RECURSO_NAO_ENCONTRADO');
    await ctx.http.patch(`/api/v1/ordens-servico/${osB.body.id}`).set(auth(a.token)).send({ diagnostico: 'Invadido' }).expect(404);
    await ctx.http.get(`/api/v1/veiculos/${osB.body.veiculo.id}/ordens-servico`).set(auth(a.token)).expect(404);
    await ctx.http.get(`/api/v1/clientes/${osB.body.cliente.id}/ordens-servico`).set(auth(a.token)).expect(404);
    await ctx.http.get('/api/v1/veiculos/consulta').query({ placa: placaB }).set(auth(a.token)).expect(404);

    const osA = await abrir(a.token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Da oficina A' }).expect(201);
    const lista = await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'abertas' }).set(auth(a.token)).expect(200);
    expect(lista.body.itens.map((o: { id: string }) => o.id)).toEqual([osA.body.id]);
    // cursor apontando para a OS de B não devolve nada nem vaza a posição dela
    const comCursorDeB = await ctx.http.get('/api/v1/ordens-servico').query({ situacao: 'abertas', cursor: osB.body.id }).set(auth(a.token)).expect(200);
    expect(comCursorDeB.body).toEqual({ itens: [], proximoCursor: null });

    // a mesma placa em A vira outro veículo, sem tocar no de B
    const mesmaPlaca = await abrir(a.token, { placa: placaB, telefone: telefoneTeste(), relatoCliente: 'Placa igual' }).expect(201);
    expect(mesmaPlaca.body.veiculo.id).not.toBe(osB.body.veiculo.id);

    const intacta = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.ordemServico.findUnique({ where: { id: osB.body.id } }));
    expect(intacta?.diagnostico).toBeNull();
  });

  it('FUNCIONARIO abre OS (tem OS_GERENCIAR)', async () => {
    const { usuario, token } = await oficinaLogada('FUNCIONARIO');
    const r = await abrir(token, { placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Pneu furado', responsavelId: usuario.id }).expect(201);
    expect(r.body.responsavel).toEqual({ id: usuario.id, nome: usuario.nome });
  });

  it('sem login → 401', async () => {
    await ctx.http.post('/api/v1/ordens-servico').send({ placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Revisão' }).expect(401);
  });
});
