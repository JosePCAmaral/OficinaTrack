import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErroApi } from '@/lib/api';
import { useReenviarConfirmacao } from '../api/use-reenviar-confirmacao';
import { TelaPublica } from '../components/tela-publica';

const ESPERA_SEGUNDOS = 60;

export function VerifiqueSeuEmail() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;
  const mutacao = useReenviarConfirmacao();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearInterval(temporizador.current);
    };
  }, []);

  function iniciarContagem() {
    setSegundosRestantes(ESPERA_SEGUNDOS);
    temporizador.current = setInterval(() => {
      setSegundosRestantes((s) => {
        if (s <= 1 && temporizador.current) {
          clearInterval(temporizador.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function reenviar() {
    if (!email) return;
    setMensagem(null);
    setErro(null);
    try {
      const resposta = await mutacao.mutateAsync(email);
      setMensagem(resposta.mensagem);
      iniciarContagem();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível completar a ação. Tente de novo.');
    }
  }

  return (
    <TelaPublica titulo="Verifique seu e-mail">
      <p>
        Enviamos um link para <strong>{email ?? 'o seu e-mail'}</strong>. Abra seu e-mail e clique em Confirmar.
      </p>
      {mensagem && (
        <Alert>
          <AlertDescription>{mensagem}</AlertDescription>
        </Alert>
      )}
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        className="h-11"
        onClick={reenviar}
        disabled={!email || mutacao.isPending || segundosRestantes > 0}
      >
        {segundosRestantes > 0 ? `Reenviar e-mail (${segundosRestantes}s)` : 'Reenviar e-mail'}
      </Button>
    </TelaPublica>
  );
}
