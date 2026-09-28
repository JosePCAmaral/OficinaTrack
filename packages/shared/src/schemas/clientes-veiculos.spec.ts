import { alterarClienteSchema, alterarVeiculoSchema, buscaSchema } from './clientes-veiculos.js';

describe('alterarClienteSchema', () => {
  it('normaliza telefone, e-mail e documento; vazio vira null', () => {
    expect(alterarClienteSchema.parse({ telefone: '(43) 98888-7777', email: ' Ze@X.com ', documento: '123.456.789-09', nome: '' }))
      .toEqual({ telefone: '+5543988887777', email: 'ze@x.com', documento: '12345678909', nome: null });
    expect(alterarClienteSchema.parse({ email: '' })).toEqual({ email: null });
  });
});

describe('alterarVeiculoSchema', () => {
  it('normaliza placa e aceita ano entre 1950 e o próximo ano', () => {
    expect(alterarVeiculoSchema.parse({ placa: 'abc-1234', anoModelo: '2019' })).toEqual({ placa: 'ABC1234', anoModelo: 2019 });
    expect(alterarVeiculoSchema.safeParse({ anoModelo: 1900 }).success).toBe(false);
  });
});

describe('buscaSchema', () => {
  it('2 a 100 caracteres', () => {
    expect(buscaSchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(buscaSchema.parse({ q: ' ze ' })).toEqual({ q: 'ze' });
  });
});
