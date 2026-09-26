import { cadastroSchema, emailSchema, loginSchema, senhaSchema, trocarSenhaSchema, VERSAO_TERMOS } from './auth.js';

const cadastroValido = {
  codigoPiloto: 'ABCD-EFGH-JKLM',
  oficina: { nome: 'Oficina do Zé', telefone: '(43) 99999-8888', cidade: 'Ribeirão do Pinhal', uf: 'PR' },
  dono: { nome: 'José', email: ' Ze@Oficina.com ', senha: 'motor-v8-turbo' },
  aceiteTermos: true,
};

describe('emailSchema', () => {
  it('normaliza antes de validar (Review Focus 2)', () => {
    expect(emailSchema.parse('  Dono@Oficina.COM ')).toBe('dono@oficina.com');
  });
  it.each(['', 'sem-arroba', 'a@', '@b.com', `${'a'.repeat(250)}@b.com`])('recusa %s', (v) => {
    expect(emailSchema.safeParse(v).success).toBe(false);
  });
});

describe('senhaSchema', () => {
  it('aceita senha de 8+ caracteres incomum', () => {
    expect(senhaSchema.safeParse('motor-v8-turbo').success).toBe(true);
  });
  it.each([
    ['curta', 'pelo menos 8'],
    ['12345678', 'muito comum'],
    ['Senha123', 'muito comum'],
    ['x'.repeat(129), 'no máximo 128'],
  ])('recusa %s', (senha, trecho) => {
    const r = senhaSchema.safeParse(senha);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain(trecho);
  });
});

describe('cadastroSchema', () => {
  it('normaliza e-mail e telefone', () => {
    const r = cadastroSchema.parse(cadastroValido);
    expect(r.dono.email).toBe('ze@oficina.com');
    expect(r.oficina.telefone).toBe('+5543999998888');
  });
  it('WhatsApp do dono é opcional e sai em E.164; vazio vira undefined; inválido é recusado', () => {
    expect(cadastroSchema.parse(cadastroValido).dono.telefone).toBeUndefined();
    const com = (telefone: string) => cadastroSchema.safeParse({ ...cadastroValido, dono: { ...cadastroValido.dono, telefone } });
    expect(com('(43) 98888-7777').data?.dono.telefone).toBe('+5543988887777');
    expect(com('').data?.dono.telefone).toBeUndefined();
    expect(com('123').success).toBe(false);
  });
  it('exige aceite dos termos', () => {
    expect(cadastroSchema.safeParse({ ...cadastroValido, aceiteTermos: false }).success).toBe(false);
  });
  it('VERSAO_TERMOS é a versão vigente', () => {
    expect(VERSAO_TERMOS).toBe('2026-09');
  });
});

describe('loginSchema', () => {
  it('não aplica a política de senha no login (senhas antigas continuam entrando)', () => {
    expect(loginSchema.safeParse({ identificador: 'ze@oficina.com', senha: 'x' }).success).toBe(true);
  });
});

describe('trocarSenhaSchema', () => {
  it('recusa nova senha igual à atual', () => {
    expect(trocarSenhaSchema.safeParse({ senhaAtual: 'motor-v8-turbo', novaSenha: 'motor-v8-turbo' }).success).toBe(false);
  });
});
