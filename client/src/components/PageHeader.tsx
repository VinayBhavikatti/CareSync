import type { ReactNode } from 'react';

export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: ReactNode; eyebrow?: string }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="mb-1 text-base font-bold uppercase tracking-wide text-muted">{eyebrow}</p>}
      <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-lg leading-relaxed text-muted">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>;
}
