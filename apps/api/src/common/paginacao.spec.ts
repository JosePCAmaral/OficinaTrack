import { argsPaginacao, paginar } from './paginacao.js';

describe('paginar', () => {
  it('menos linhas que o limite: devolve tudo e proximoCursor null', () => {
    const linhas = [{ id: 'a' }, { id: 'b' }];
    expect(paginar(linhas, 5)).toEqual({ itens: linhas, proximoCursor: null });
  });

  it('exatamente o limite: proximoCursor null (não sobrou nada para cortar)', () => {
    const linhas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(paginar(linhas, 3)).toEqual({ itens: linhas, proximoCursor: null });
  });

  it('limite + 1 linhas: corta a última e devolve o id do último item da página', () => {
    const linhas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(paginar(linhas, 2)).toEqual({ itens: [{ id: 'a' }, { id: 'b' }], proximoCursor: 'b' });
  });

  it('sem linhas: itens vazio e proximoCursor null', () => {
    expect(paginar([], 5)).toEqual({ itens: [], proximoCursor: null });
  });
});

describe('argsPaginacao', () => {
  it('sem cursor: só take', () => {
    expect(argsPaginacao({ limite: 20 })).toEqual({ take: 21 });
  });

  it('com cursor: take, cursor e skip para pular o próprio cursor', () => {
    expect(argsPaginacao({ limite: 10, cursor: 'abc' })).toEqual({ take: 11, cursor: { id: 'abc' }, skip: 1 });
  });
});
