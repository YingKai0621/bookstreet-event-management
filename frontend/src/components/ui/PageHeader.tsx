import React from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  actions,
  className = '',
}) => {
  return (
    <header className={`shared-page-header ${className}`}>
      <div className="shared-page-header-main">
        {eyebrow && <span className="shared-page-eyebrow">{eyebrow}</span>}
        <h1 className="shared-page-title">{title}</h1>
        {subtitle && <p className="shared-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="shared-page-header-actions">{actions}</div>}
    </header>
  );
};
