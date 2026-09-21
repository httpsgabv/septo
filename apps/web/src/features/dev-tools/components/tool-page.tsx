import type { ReactNode } from 'react';
import { type Tool, toolFor } from '../domain/tools';

/**
 * Old frame, on its way out: each tool moves to `Workspace` (revision 1 of the spec).
 */
export function ToolPage({ to, children }: { to: Tool['to']; children: ReactNode }) {
  const tool = toolFor(to);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-12 sm:px-6 md:px-10 md:pt-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{tool.label}</h1>
      </header>
      {children}
    </div>
  );
}
