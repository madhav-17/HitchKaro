import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${onClick ? 'cursor-pointer transition-all hover:shadow-md hover:border-slate-300' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
