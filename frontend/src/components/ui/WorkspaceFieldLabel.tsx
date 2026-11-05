import type { ReactNode } from 'react';
import './SearchFieldLabel.css';

export function WorkspaceFieldLabel({ children, className = '', label }: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return <div className={`workspace-search-field ${className}`}>
    <span>{label}</span>
    {children}
  </div>;
}
