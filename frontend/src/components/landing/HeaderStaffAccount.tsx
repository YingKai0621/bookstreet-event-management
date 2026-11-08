import { Briefcase, ChevronDown, LogOut, ShieldCheck, Store } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Language } from '../../types';

export interface StaffWorkspace {
  role: 'ADMIN' | 'ORGANIZER' | 'PARTNER';
  path: string;
}

/** A signed-in account that holds a staff role works only in its staff workspaces, never as a reader. */
export interface StaffAccount {
  name: string;
  email: string;
  workspaces: StaffWorkspace[];
}

const LABELS: Record<StaffWorkspace['role'], { vi: string; en: string; badgeVi: string; badgeEn: string }> = {
  ADMIN: { vi: 'Trang quản trị', en: 'Admin workspace', badgeVi: 'Quản trị viên', badgeEn: 'Administrator' },
  ORGANIZER: { vi: 'Khu Ban tổ chức', en: 'Organizer workspace', badgeVi: 'Ban tổ chức', badgeEn: 'Organizer' },
  PARTNER: { vi: 'Khu Đối tác', en: 'Partner workspace', badgeVi: 'Đối tác', badgeEn: 'Partner' },
};

function WorkspaceIcon({ role, size }: { role: StaffWorkspace['role']; size: number }) {
  if (role === 'ADMIN') return <ShieldCheck size={size} className="dropdown-item-icon" />;
  if (role === 'ORGANIZER') return <Briefcase size={size} className="dropdown-item-icon" />;
  return <Store size={size} className="dropdown-item-icon" />;
}

function initials(name: string) {
  return name ? name.slice(0, 2).toUpperCase() : 'NA';
}

function staffBadge(account: StaffAccount, language: Language) {
  const primary = LABELS[account.workspaces[0].role];
  return language === 'vi' ? primary.badgeVi : primary.badgeEn;
}

export const StaffAccountMenu: React.FC<{
  account: StaffAccount;
  language: Language;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogout?: () => void;
}> = ({ account, language, open, onToggle, onClose, onLogout }) => (
  <>
    <button
      type="button"
      className={`ticket-user-pill ${open ? 'is-active' : ''}`}
      onClick={onToggle}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={language === 'vi' ? 'Tài khoản của tôi' : 'My account'}
    >
      <span className="ticket-user-avatar">{initials(account.name)}</span>
      <span className="ticket-user-name">{account.name}</span>
      <ChevronDown size={14} className={`ticket-user-chevron ${open ? 'open' : ''}`} />
    </button>

    {open && (
      <div className="ticket-user-dropdown-menu" role="menu">
        <div className="ticket-dropdown-user-header">
          <div className="dropdown-user-avatar">{initials(account.name)}</div>
          <div className="dropdown-user-info-text">
            <span className="dropdown-user-name">{account.name}</span>
            <span className="dropdown-user-email">{account.email}</span>
            <span className="dropdown-user-badge">{staffBadge(account, language)}</span>
          </div>
        </div>
        <div className="ticket-dropdown-divider" />
        <div className="ticket-dropdown-links-list">
          {account.workspaces.map(workspace => (
            <Link key={workspace.role} to={workspace.path} className="ticket-dropdown-link" role="menuitem" onClick={onClose}>
              <WorkspaceIcon role={workspace.role} size={16} />
              <span>{language === 'vi' ? LABELS[workspace.role].vi : LABELS[workspace.role].en}</span>
            </Link>
          ))}
        </div>
        <div className="ticket-dropdown-divider" />
        <button
          type="button"
          className="ticket-dropdown-link logout"
          role="menuitem"
          onClick={() => {
            onClose();
            onLogout?.();
          }}
        >
          <LogOut size={16} className="dropdown-item-icon" />
          <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
        </button>
      </div>
    )}
  </>
);

export const StaffAccountDrawer: React.FC<{
  account: StaffAccount;
  language: Language;
  onClose: () => void;
  onLogout?: () => void;
}> = ({ account, language, onClose, onLogout }) => (
  <div className="mobile-drawer-participant-auth">
    <div className="mobile-user-card">
      <div className="ticket-user-avatar">{initials(account.name)}</div>
      <div className="mobile-user-info">
        <strong>{account.name}</strong>
        <span>{staffBadge(account, language)}</span>
      </div>
    </div>
    <div className="mobile-user-links-grid">
      {account.workspaces.map(workspace => (
        <Link key={workspace.role} to={workspace.path} className="mobile-user-link-btn" onClick={onClose}>
          <WorkspaceIcon role={workspace.role} size={15} />
          <span>{language === 'vi' ? LABELS[workspace.role].vi : LABELS[workspace.role].en}</span>
        </Link>
      ))}
    </div>
    <button
      type="button"
      className="mobile-auth-btn secondary"
      style={{ marginTop: '0.65rem' }}
      onClick={() => {
        onClose();
        onLogout?.();
      }}
    >
      <LogOut size={16} />
      <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
    </button>
  </div>
);
