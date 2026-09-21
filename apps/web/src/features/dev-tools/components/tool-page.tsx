import type { ReactNode } from 'react';
import { type Tool, toolFor } from '../domain/tools';

/**
 * Frame shared by the six tools. The heading comes from `tools.ts` so the card, the strip and the
 * page never drift apart, and the notice is repeated on every tool on purpose: it is the promise
 * that makes it safe to paste a production dump or look at a private key here.
 */
export function ToolPage({ to, children }: { to: Tool['to']; children: ReactNode }) {
  const tool = toolFor(to);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-12 sm:px-6 md:px-10 md:pt-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{tool.label}</h1>
        <p className="mt-1 text-muted-foreground">{tool.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Roda inteiro no seu navegador: nada é enviado para o servidor nem guardado ao sair.
        </p>
      </header>
      {children}
    </div>
  );
}
