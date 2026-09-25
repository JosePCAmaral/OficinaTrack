import { alterarUsuarioSchema, conviteSchema } from './equipe.js';

describe('conviteSchema', () => {
  it('perfil padrão FUNCIONARIO e telefone opcional', () => {
    const r = conviteSchema.parse({ nome: 'Mecânico', email: 'MEC@x.com', telefone: '' });
    expect(r).toEqual({ nome: 'Mecânico', email: 'mec@x.com', perfil: 'FUNCIONARIO' });
  });
});

describe('alterarUsuarioSchema', () => {
  it('exige ao menos um campo', () => {
    expect(alterarUsuarioSchema.safeParse({}).success).toBe(false);
  });
});
