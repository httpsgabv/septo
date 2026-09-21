import { Button } from '@septo/ui/components/button';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type State = 'idle' | 'copied' | 'failed';

export function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const [state, setState] = useState<State>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Denied permission or an insecure context: say so instead of pretending it worked.
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} disabled={!value}>
      {state === 'copied' ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      {state === 'copied' ? 'Copiado' : state === 'failed' ? 'Não deu para copiar' : label}
    </Button>
  );
}
