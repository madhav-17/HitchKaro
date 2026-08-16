import type { ReactNode } from 'react';

type BadgeColor = 'emerald' | 'amber' | 'red' | 'slate' | 'blue';

const colors: Record<BadgeColor, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
};

export function Badge({
  children,
  color = 'slate',
  className = '',
}: {
  children: ReactNode;
  color?: BadgeColor;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[color]} ${className}`}
    >
      {children}
    </span>
  );
}
