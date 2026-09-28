import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { hashSenha } from '../../src/common/seguranca/senhas.js';
import { TenantContext } from '../../src/common/tenant/tenant-context.js';
import { configurarApp } from '../../src/configurar-app.js';
import { EnvioEmailMemoria } from '../../src/modules/notificacoes/envio-email-memoria.js';
import { conflitoEnvolveCampo } from '../../src/prisma/conflito-unicidade.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { telefoneTeste } from '../telefone-teste.js';

export const ORIGEM = 'http://localhost:5173';
export const SENHA = 'motor-v8-turbo';
export const sufixo = () => randomBytes(6).toString('hex');
export const telefone = telefoneTeste;

const MAX_TENTATIVAS_TELEFONE = 3;

/**
 * `Usuario.telefone` é único no sistema inteiro e o banco de teste nunca é zerado: mesmo com o
 * espaço cheio de 8 dígitos, uma colisão eventual ainda é possível. Tenta de novo com um telefone
 * novo quando é isso que colidiu; qualquer outro erro sobe na hora.
 */
async function comRetentativaDeTelefone<T>(criar: (telefone: string) => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await criar(telefone());
    } catch (erro) {
      if (tentativa >= MAX_TENTATIVAS_TELEFONE || !conflitoEnvolveCampo(erro, 'telefone')) throw erro;
    }
  }
}

export type App = { app: INestApplication; http: ReturnType<typeof request>; prisma: PrismaService; tenant: TenantContext; emails: EnvioEmailMemoria };

export async function criarApp(): Promise<App> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication({ bodyParser: false });
  configurarApp(app);
  await app.init();
  return { app, http: request(app.getHttpServer()), prisma: modulo.get(PrismaService), tenant: modulo.get(TenantContext), emails: modulo.get(EnvioEmailMemoria) };
}

/** Oficina com usuário de e-mail confirmado e senha conhecida, criada direto no banco. */
export async function criarOficinaComUsuario(ctx: App, perfil: 'DONO' | 'FUNCIONARIO' = 'DONO') {
  // sem tenant: a oficina ainda não existe
  const oficina = await ctx.tenant.executarSemTenant(() =>
    ctx.prisma.db.oficina.create({ data: { nome: `Oficina ${sufixo()}`, telefone: telefone(), termosVersao: '2026-09', termosAceitosEm: new Date() } }),
  );
  const usuario = await criarUsuarioNa(ctx, oficina.id, perfil);
  return { oficina, usuario };
}

export async function criarUsuarioNa(ctx: App, oficinaId: string, perfil: 'DONO' | 'FUNCIONARIO', extra: { emailConfirmadoEm?: Date | null; ativo?: boolean } = {}) {
  const senhaHash = await hashSenha(SENHA);
  return ctx.tenant.executarComo(oficinaId, () =>
    comRetentativaDeTelefone((tel) =>
      ctx.prisma.db.usuario.create({
        data: {
          oficinaId,
          nome: `Usuário ${sufixo()}`,
          email: `u-${sufixo()}@teste.local`,
          telefone: tel,
          senhaHash,
          perfil,
          emailConfirmadoEm: extra.emailConfirmadoEm === undefined ? new Date() : extra.emailConfirmadoEm,
          ativo: extra.ativo ?? true,
        },
      }),
    ),
  );
}

export function cookieRefresh(res: { headers: Record<string, unknown> }): string {
  const cookies = ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []);
  const c = cookies.find((x) => x.startsWith('ot_refresh='));
  if (!c) throw new Error('sem cookie ot_refresh');
  return c.split(';')[0]!;
}

export async function entrar(ctx: App, email: string, senha = SENHA) {
  const res = await ctx.http.post('/api/v1/auth/login').set('Origin', ORIGEM).send({ identificador: email, senha }).expect(200);
  return { accessToken: res.body.accessToken as string, cookie: cookieRefresh(res), corpo: res.body };
}
