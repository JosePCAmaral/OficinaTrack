import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErroApi } from '@/lib/api';
import { useConfirmarEmail } from '../api/use-confirmar-email';
import { TelaPublica } from '../components/tela-publica';
import { useAuth } from '../contexto/use-auth';
import { useSemReferrer } from '../hooks/use-sem-referrer';
import { useTokenHash } from '../hooks/use-token-hash';

export function ConfirmarEmail() {
  useSemReferrer();
  const token = useTokenHash();
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const mutacao = useConfirmarEmail();
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    try {
      const resposta = await mutacao.mutateAsync(token);
      entrar(resposta);
      navigate('/painel', { replace: true });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível completar a ação. Tente de novo.');
    }
  }

  return (
    <TelaPublica titulo="Confirmar e-mail">
      <p>Confirme seu e-mail para ativar sua conta.</p>
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>
            {erro}{' '}
            <Link to="/verifique-seu-email" className="underline underline-offset-4">
              Reenviar link de confirmação
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <Button type="button" className="h-11" onClick={confirmar} disabled={mutacao.isPending || !token}>
        {mutacao.isPending ? 'Confirmando…' : 'Confirmar meu e-mail'}
      </Button>
    </TelaPublica>
  );
}
