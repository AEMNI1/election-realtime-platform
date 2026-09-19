import type { ReactNode } from 'react';
export function StatusPill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate'|'green'|'red'|'orange'|'blue' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800'
  }[tone];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}
