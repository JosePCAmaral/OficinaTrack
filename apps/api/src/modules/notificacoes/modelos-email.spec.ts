import { modelosEmail } from './modelos-email.js';

describe('modelos de e-mail', () => {
  it('confirmação traz o link no texto e no html e escapa o nome', () => {
    const m = modelosEmail.confirmarEmail({ nome: '<b>Zé</b>', link: 'http://localhost:5173/confirmar-email#abc' });
    expect(m.assunto).toBe('Confirme seu e-mail no OficinaTrack');
    expect(m.texto).toContain('http://localhost:5173/confirmar-email#abc');
    expect(m.html).toContain('href="http://localhost:5173/confirmar-email#abc"');
    expect(m.html).toContain('&lt;b&gt;Zé&lt;/b&gt;');
    expect(m.html).not.toContain('<b>Zé</b>');
  });
  it('convite cita a oficina', () => {
    const m = modelosEmail.convite({ nomeOficina: 'Oficina do Zé', nomeConvidado: 'Ana', link: 'http://x/convite#t' });
    expect(m.assunto).toBe('Oficina do Zé convidou você para o OficinaTrack');
  });
});
