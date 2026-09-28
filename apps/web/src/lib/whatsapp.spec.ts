import { linkWhatsApp, mensagemAtualizacao } from './whatsapp';

describe('linkWhatsApp', () => {
  it('tira o + e codifica acentos, &, #, quebra de linha e emoji', () => {
    const texto = 'Peça & mão de obra #1\nChega amanhã 🚗';
    const url = linkWhatsApp('+5543999998888', texto);
    expect(url.startsWith('https://wa.me/5543999998888?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1]!)).toBe(texto);
    expect(url).not.toContain('#1');
    expect(url).not.toContain('\n');
  });
});

describe('mensagemAtualizacao', () => {
  it('usa o nome do cliente e o modelo; sem nome usa "tudo bem"; sem modelo usa a placa formatada', () => {
    expect(mensagemAtualizacao({ nomeCliente: 'João', nomeOficina: 'Oficina do Zé', veiculo: { modelo: 'Gol', placa: 'ABC1234' }, texto: 'Pronto!' }))
      .toBe('Olá, João! Oficina do Zé sobre o Gol: Pronto!');
    expect(mensagemAtualizacao({ nomeCliente: null, nomeOficina: 'Oficina do Zé', veiculo: { modelo: null, placa: 'ABC1234' }, texto: 'Pronto!' }))
      .toBe('Olá, tudo bem! Oficina do Zé sobre o ABC-1234: Pronto!');
  });
});
