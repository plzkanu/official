import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
}

export default function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="page-title">{title}</h1>
      {description && <p className="page-subtitle">{description}</p>}
    </div>
  );
}

interface CardPanelProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function CardPanel({ title, description, children, className = '' }: CardPanelProps) {
  return (
    <div className={`card-panel ${className}`}>
      {(title || description) && (
        <div className="card-panel-header">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
      )}
      <div className={title || description ? 'card-panel-body' : 'px-5 py-5'}>{children}</div>
    </div>
  );
}
