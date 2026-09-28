import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type CampoPlacaProps = {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  onBlur: () => void;
  error?: string;
};

/** Maiúsculas automáticas ao digitar; a consulta por placa (blur) é decidida por quem usa este campo. */
export function CampoPlaca({ id, value, onChange, onBlur, error }: CampoPlacaProps) {
  const erroId = `${id}-erro`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Placa</Label>
      <Input
        id={id}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={8}
        placeholder="ABC1D23"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? erroId : undefined}
        className={cn('h-11 uppercase tracking-widest')}
      />
      {error && (
        <p id={erroId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
