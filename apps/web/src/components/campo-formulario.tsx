import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type CampoFormularioProps = {
  id: string;
  label: string;
  error?: string;
  registro: UseFormRegisterReturn;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
};

export function CampoFormulario({
  id,
  label,
  error,
  registro,
  type = 'text',
  autoComplete,
  placeholder,
  className,
  readOnly,
}: CampoFormularioProps) {
  const erroId = `${id}-erro`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-invalid={!!error}
        aria-describedby={error ? erroId : undefined}
        className={cn('h-11', className)}
        {...registro}
      />
      {error && (
        <p id={erroId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
