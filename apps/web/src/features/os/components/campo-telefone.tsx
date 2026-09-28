import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** `(43) 99999-8888` enquanto digita; a normalização para E.164 é feita pelo schema no envio. */
export function mascararTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

/** Telefone em E.164 (`+5543999998888`) para exibição mascarada num campo. */
export function formatarTelefoneExibicao(telefoneE164: string): string {
  return mascararTelefone(telefoneE164.replace(/^\+55/, ''));
}

type CampoTelefoneProps = {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  error?: string;
};

export function CampoTelefone({ id, label, value, onChange, error }: CampoTelefoneProps) {
  const erroId = `${id}-erro`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(43) 99999-8888"
        value={value}
        onChange={(e) => onChange(mascararTelefone(e.target.value))}
        aria-invalid={!!error}
        aria-describedby={error ? erroId : undefined}
        className="h-11"
      />
      {error && (
        <p id={erroId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
