/**
 * Auditoria da Sprint 3 (docs/auditorias/2026-09-28-sprint-3.md): OS rápida, clientes, veículos,
 * busca e eventos da OS. Complementa `test/os/*.e2e-spec.ts` com os caminhos que a auditoria
 * seguiu e que ainda não tinham teste: cursor de outra oficina nos históricos e nos eventos,
 * `eventoId` de outra oficina, `responsavelId` de outra oficina no PATCH, mass assignment nos
 * três PATCH e no POST de eventos, retirada por perfil e injeção na busca.
 *
 * Os testes marcados "FALHA HOJE" provam um achado ainda aberto; os demais são regressão.
 */
import { criarApp, criarOficinaComUsuario, criarUsuarioNa, entrar, type App } from '../auth/apoio-auth.js';
import { auth, criarClienteNa, criarVeiculoNa, placaUnica } from '../os/apoio-os.js';
import { telefoneTeste } from '../telefone-teste.js';

const eventos = (osId: string) => `/api/v1/ordens-servico/${osId}/eventos`;

describe('Segurança Sprint 3: OS, clientes, veículos, busca e eventos', () => {
  let ctx: App;
  beforeAll(async () => { ctx = await criarApp(); });
  afterAll(() => ctx.app.close());

  async function oficinaLogada(perfil: 'DONO' | 'FUNCIONARIO' = 'DONO') {
    const { oficina, usuario } = await criarOficinaComUsuario(ctx, perfil);
    const { accessToken } = await entrar(ctx, usuario.email);
    return { oficina, usuario, token: accessToken };
  }

  async function abrirOs(token: string, extra: Record<string, unknown> = {}) {
    const r = await ctx.http
      .post('/api/v1/ordens-servico')
      .set(auth(token))
      .send({ placa: placaUnica(), telefone: telefoneTeste(), relatoCliente: 'Revisão geral', ...extra })
      .expect(201);
    return r.body as { id: string; numero: number; status: string; veiculo: { id: string }; cliente: { id: string; telefone: string } };
  }

  describe('T1: isolamento nos caminhos novos', () => {
    it('[regressão T1] cursor de OS/evento de outra oficina nos históricos e na linha do tempo → página vazia', async () => {
      const a = await oficinaLogada();
      const b = await oficinaLogada();
      const osA = await abrirOs(a.token);
      const osB = await abrirOs(b.token);
      const eventoB = await ctx.http.post(eventos(osB.id)).set(auth(b.token)).send({ tipo: 'NOTA_INTERNA', texto: 'Segredo de B' }).expect(201);

      for (const rota of [`/api/v1/veiculos/${osA.veiculo.id}/ordens-servico`, `/api/v1/clientes/${osA.cliente.id}/ordens-servico`]) {
        const r = await ctx.http.get(rota).query({ cursor: osB.id }).set(auth(a.token)).expect(200);
        expect(r.body).toEqual({ itens: [], proximoCursor: null });
      }
      const r = await ctx.http.get(eventos(osA.id)).query({ cursor: eventoB.body.id }).set(auth(a.token)).expect(200);
      expect(r.body).toEqual({ itens: [], proximoCursor: null });
      expect(JSON.stringify(r.body)).not.toContain('Segredo de B');
    });

    it('[regressão T1] retirar pela OS de A com eventoId de B → 404 e o evento de B continua intacto', async () => {
      const a = await oficinaLogada();
      const b = await oficinaLogada();
      const osA = await abrirOs(a.token);
      const osB = await abrirOs(b.token);
      const eventoB = await ctx.http.post(eventos(osB.id)).set(auth(b.token)).send({ tipo: 'ATUALIZACAO_CLIENTE', texto: 'Pronto' }).expect(201);

      const r = await ctx.http.post(`${eventos(osA.id)}/${eventoB.body.id}/retirar`).set(auth(a.token)).send().expect(404);
      expect(r.body.code).toBe('RECURSO_NAO_ENCONTRADO');
      const intacto = await ctx.tenant.executarComo(b.oficina.id, () => ctx.prisma.db.eventoOS.findUnique({ where: { id: eventoB.body.id } }));
      expect(intacto).toMatchObject({ retiradoEm: null, retiradoPorId: null });
    });

    it('[regressão T1] PATCH da OS com responsavelId de outra oficina → 422 e nada muda', async () => {
      const a = await oficinaLogada();
      const b = await oficinaLogada();
      const os = await abrirOs(a.token);

      const r = await ctx.http.patch(`/api/v1/ordens-servico/${os.id}`).set(auth(a.token)).send({ responsavelId: b.usuario.id, diagnostico: 'x' }).expect(422);
      expect(r.body.code).toBe('RESPONSAVEL_INVALIDO');
      const atual = await ctx.tenant.executarComo(a.oficina.id, () => ctx.prisma.db.ordemServico.findUnique({ where: { id: os.id } }));
      expect(atual).toMatchObject({ responsavelId: null, diagnostico: null });
    });

    it('[regressão T1/T6] busca com metacaracteres de SQL não quebra nem devolve dados de outra oficina', async () => {
      const a = await oficinaLogada();
      const b = await oficinaLogada();
      await criarClienteNa(ctx, b.oficina.id, { nome: "O'Brien; DROP" });
      for (const q of ["' OR 1=1 --", "O'Brien; DROP", '\\\\', '") OR ("1"="1']) {
        const r = await ctx.http.get('/api/v1/busca').query({ q }).set(auth(a.token)).expect(200);
        expect(r.body).toEqual({ clientes: [], veiculos: [] });
      }
    });
  });

  describe('T6: curinga do LIKE na busca por nome (pendência conhecida)', () => {
    it('[achado #2] FALHA HOJE: "%%" e "__" são tratados como texto, não como curinga', async () => {
      const { oficina, token } = await oficinaLogada();
      await criarClienteNa(ctx, oficina.id, { nome: 'Maria da Silva' });
      for (const q of ['%%', '__']) {
        const r = await ctx.http.get('/api/v1/busca').query({ q }).set(auth(token)).expect(200);
        expect(r.body.clientes).toEqual([]);
      }
    });
  });

  describe('Mass assignment (T1/T4)', () => {
    it('[regressão] PATCH da OS ignora status, statusDesde, numero, clienteId, veiculoId, oficinaId e criadoEm', async () => {
      const a = await oficinaLogada();
      const b = await oficinaLogada();
      const os = await abrirOs(a.token);
      const outra = await abrirOs(a.token);
      const antes = await ctx.tenant.executarComo(a.oficina.id, () => ctx.prisma.db.ordemServico.findUniqueOrThrow({ where: { id: os.id } }));

      await ctx.http.patch(`/api/v1/ordens-servico/${os.id}`).set(auth(a.token)).send({
        diagnostico: 'Pastilha gasta',
        status: 'ENTREGUE', statusDesde: '2020-01-01T00:00:00.000Z', numero: 9999,
        clienteId: outra.cliente.id, veiculoId: outra.veiculo.id, oficinaId: b.oficina.id, criadoEm: '2020-01-01T00:00:00.000Z',
      }).expect(200);

      const depois = await ctx.tenant.executarComo(a.oficina.id, () => ctx.prisma.db.ordemServico.findUniqueOrThrow({ where: { id: os.id } }));
      expect(depois.diagnostico).toBe('Pastilha gasta');
      expect({ ...depois, diagnostico: null, atualizadoEm: null }).toEqual({ ...antes, atualizadoEm: null });
    });

    it('[regressão] PATCH só com campos proibidos → 400 (nada para alterar), sem tocar no status', async () => {
      const a = await oficinaLogada();
      const os = await abrirOs(a.token);
      await ctx.http.patch(`/api/v1/ordens-servico/${os.id}`).set(auth(a.token)).send({ status: 'CANCELADO' }).expect(400);
      const atual = await ctx.tenant.executarComo(a.oficina.id, () => ctx.prisma.db.ordemServico.findUniqueOrThrow({ where: { id: os.id } }));
      expect(atual.status).toBe(os.status);
    });

    it('[regressão] PATCH de cliente ignora id, oficinaId e criadoEm; PATCH de veículo não troca o dono (clienteId)', async () => {
      const a = await oficinaLogada();
      const b = await oficinaLogada();
      const cliente = await criarClienteNa(ctx, a.oficina.id, { nome: 'Original' });
      const outroCliente = await criarClienteNa(ctx, a.oficina.id, { nome: 'Outro' });
      const veiculo = await criarVeiculoNa(ctx, a.oficina.id, cliente.id);

      await ctx.http.patch(`/api/v1/clientes/${cliente.id}`).set(auth(a.token))
        .send({ nome: 'Novo nome', id: 'forjado', oficinaId: b.oficina.id, criadoEm: '2020-01-01T00:00:00.000Z' }).expect(200);
      await ctx.http.patch(`/api/v1/veiculos/${veiculo.id}`).set(auth(a.token))
        .send({ cor: 'Prata', clienteId: outroCliente.id, oficinaId: b.oficina.id, id: 'forjado' }).expect(200);

      const [c, v] = await ctx.tenant.executarSemTenant(() => Promise.all([
        ctx.prisma.db.cliente.findUniqueOrThrow({ where: { id: cliente.id } }),
        ctx.prisma.db.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } }),
      ]));
      expect(c).toMatchObject({ nome: 'Novo nome', oficinaId: a.oficina.id, criadoEm: cliente.criadoEm });
      expect(v).toMatchObject({ cor: 'Prata', clienteId: cliente.id, oficinaId: a.oficina.id });
    });

    it('[regressão T2] POST de evento ignora visivelCliente, autorId, retiradoEm, retiradoPorId, ordemServicoId e criadoEm', async () => {
      const a = await oficinaLogada();
      const outroUsuario = await criarUsuarioNa(ctx, a.oficina.id, 'DONO');
      const os = await abrirOs(a.token);
      const outra = await abrirOs(a.token);

      const r = await ctx.http.post(eventos(os.id)).set(auth(a.token)).send({
        tipo: 'NOTA_INTERNA', texto: 'Nota',
        visivelCliente: true, autorId: outroUsuario.id, retiradoEm: null, retiradoPorId: outroUsuario.id,
        ordemServicoId: outra.id, criadoEm: '2020-01-01T00:00:00.000Z',
      }).expect(201);

      const e = await ctx.tenant.executarComo(a.oficina.id, () => ctx.prisma.db.eventoOS.findUniqueOrThrow({ where: { id: r.body.id } }));
      expect(e).toMatchObject({ ordemServicoId: os.id, autorId: a.usuario.id, visivelCliente: false, retiradoEm: null, retiradoPorId: null });
      expect(e.criadoEm.getUTCFullYear()).toBeGreaterThan(2020);
    });
  });

  describe('T4: retirada por perfil', () => {
    it('[regressão T4] FUNCIONARIO não retira atualização publicada pelo DONO → 403', async () => {
      const { oficina, token: tokenDono } = await oficinaLogada('DONO');
      const func = await criarUsuarioNa(ctx, oficina.id, 'FUNCIONARIO');
      const { accessToken: tokenFunc } = await entrar(ctx, func.email);
      const os = await abrirOs(tokenDono);
      const atualizacao = await ctx.http.post(eventos(os.id)).set(auth(tokenDono)).send({ tipo: 'ATUALIZACAO_CLIENTE', texto: 'Orçamento pronto' }).expect(201);

      const r = await ctx.http.post(`${eventos(os.id)}/${atualizacao.body.id}/retirar`).set(auth(tokenFunc)).send().expect(403);
      expect(r.body.code).toBe('SEM_PERMISSAO');
    });

    it('[regressão T4] OS_ABERTA (visível ao cliente) não pode ser retirada → 422', async () => {
      const { oficina, token } = await oficinaLogada();
      const os = await abrirOs(token);
      const aberta = await ctx.tenant.executarComo(oficina.id, () =>
        ctx.prisma.db.eventoOS.findFirstOrThrow({ where: { ordemServicoId: os.id, tipo: 'OS_ABERTA' } }));
      const r = await ctx.http.post(`${eventos(os.id)}/${aberta.id}/retirar`).set(auth(token)).send().expect(422);
      expect(r.body.code).toBe('EVENTO_NAO_RETIRAVEL');
    });
  });

  describe('LGPD: minimização', () => {
    it('[regressão LGPD] 409 VEICULO_DE_OUTRO_CLIENTE sem nome do dono também não traz o telefone completo', async () => {
      const { oficina, token } = await oficinaLogada();
      const dono = await criarClienteNa(ctx, oficina.id, { nome: null });
      const veiculo = await criarVeiculoNa(ctx, oficina.id, dono.id);
      const r = await ctx.http.post('/api/v1/ordens-servico').set(auth(token))
        .send({ placa: veiculo.placa, telefone: telefoneTeste(), relatoCliente: 'Comprei' }).expect(409);
      expect(r.body.details).toEqual({ dono: { nome: null, telefoneFinal: dono.telefone.slice(-4) } });
      expect(JSON.stringify(r.body)).not.toContain(dono.telefone.slice(3));
    });

    it('[achado #1] FALHA HOJE: texto do VEICULO_TRANSFERIDO não deve gravar o telefone completo do dono sem nome', async () => {
      const { oficina, token } = await oficinaLogada();
      const dono = await criarClienteNa(ctx, oficina.id, { nome: null });
      const veiculo = await criarVeiculoNa(ctx, oficina.id, dono.id);
      const os = await abrirOs(token, { placa: veiculo.placa, transferirVeiculo: true });

      const evento = await ctx.tenant.executarComo(oficina.id, () =>
        ctx.prisma.db.eventoOS.findFirstOrThrow({ where: { ordemServicoId: os.id, tipo: 'VEICULO_TRANSFERIDO' } }));
      expect(evento.visivelCliente).toBe(false);
      expect(evento.texto).not.toContain(dono.telefone);
      expect(evento.texto).not.toContain(os.cliente.telefone);
    });
  });
});
