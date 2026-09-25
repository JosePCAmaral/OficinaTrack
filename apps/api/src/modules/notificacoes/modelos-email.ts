type Modelo = { assunto: string; texto: string; html: string };

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function montar(assunto: string, saudacao: string, paragrafo: string, rotuloBotao: string, link: string, rodape: string): Modelo {
  const texto = `${saudacao}\n\n${paragrafo}\n\n${rotuloBotao}: ${link}\n\n${rodape}`;
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1b2220;line-height:1.5">
<p>${escapar(saudacao)}</p><p>${escapar(paragrafo)}</p>
<p><a href="${escapar(link)}" style="display:inline-block;padding:12px 20px;background:#1f4e8c;color:#fff;text-decoration:none;border-radius:8px">${escapar(rotuloBotao)}</a></p>
<p style="font-size:13px;color:#5c6662">${escapar(rodape)}</p></body></html>`;
  return { assunto, texto, html };
}

export const modelosEmail = {
  confirmarEmail: ({ nome, link }: { nome: string; link: string }) =>
    montar('Confirme seu e-mail no OficinaTrack', `Olá, ${nome}!`, 'Falta só confirmar seu e-mail para começar a usar o OficinaTrack.',
      'Confirmar e-mail', link, 'O link vale por 24 horas. Se você não criou esta conta, ignore este e-mail.'),
  redefinirSenha: ({ nome, link }: { nome: string; link: string }) =>
    montar('Redefinição de senha do OficinaTrack', `Olá, ${nome}!`, 'Recebemos um pedido para redefinir sua senha.',
      'Criar nova senha', link, 'O link vale por 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.'),
  convite: ({ nomeOficina, nomeConvidado, link }: { nomeOficina: string; nomeConvidado: string; link: string }) =>
    montar(`${nomeOficina} convidou você para o OficinaTrack`, `Olá, ${nomeConvidado}!`,
      `A ${nomeOficina} convidou você para acompanhar os carros do pátio pelo OficinaTrack.`,
      'Aceitar convite', link, 'O convite vale por 72 horas.'),
};
