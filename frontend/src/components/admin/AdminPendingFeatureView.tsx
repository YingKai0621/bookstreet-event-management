import React from 'react';

/** Holds a Sprint 11 route until its owning package replaces it with the real screen. */
export const AdminPendingFeatureView: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="adm-audit-view">
    <div className="adm-page-header">
      <div>
        <h1 className="adm-page-title workspace-page-title">{title}</h1>
        <p className="adm-page-subtitle workspace-page-subtitle">{description}</p>
      </div>
    </div>
    <div className="adm-card adm-table-card">
      <div className="adm-table-empty" role="status">
        <p>Chức năng này đang được hoàn thiện.</p>
      </div>
    </div>
  </div>
);
