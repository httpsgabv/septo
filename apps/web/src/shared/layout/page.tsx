import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Page({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 md:px-10 md:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </header>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed px-6 py-10">
      <Icon className="size-5 text-brand-text" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 max-w-prose text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
