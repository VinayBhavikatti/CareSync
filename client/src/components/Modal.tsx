import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export function Modal({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const getFocusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') ?? []);
    getFocusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const nodes = getFocusable();
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    };
    dialog?.addEventListener('keydown', keydown);
    return () => dialog?.removeEventListener('keydown', keydown);
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="shared-modal-title" className={`max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-6 shadow-2xl ${className}`} style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="shared-modal-title" className="text-2xl font-bold">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog"><X aria-hidden="true" /></Button>
      </div>
      {children}
    </div>
  </div>;
}
