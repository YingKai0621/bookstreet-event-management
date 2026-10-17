import React from 'react';
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  isError?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  isError = false,
}) => {
  const IconComponent = icon || (isError ? <AlertCircle size={32} /> : <FolderOpen size={32} />);

  return (
    <div className={`shared-empty-state ${isError ? 'is-error' : ''}`}>
      <div className="shared-empty-state-icon" aria-hidden="true">
        {IconComponent}
      </div>
      <h3 className="shared-empty-state-title">{title}</h3>
      {description && <p className="shared-empty-state-desc">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          className="shared-empty-state-btn"
          onClick={onAction}
        >
          {isError && <RefreshCw size={14} />}
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
