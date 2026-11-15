import type { ReactNode } from 'react';
export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="card flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
    {icon && <div className="mb-4 text-caresync-700 dark:text-caresync-300" aria-hidden="true">{icon}</div>}
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="mt-2 max-w-xl text-lg leading-relaxed text-muted">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}
