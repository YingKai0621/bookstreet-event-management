import { BookOpen, PanelLeft, X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import './RoleSidebar.css';
import { useModalDismiss } from '../../hooks/useModalDismiss';

export interface RoleSidebarItem {
  id: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}

interface RoleSidebarProps {
  ariaLabel: string;
  roleLabel: string;
  editionLabel: string;
  items: RoleSidebarItem[];
  activeId: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onSelect: (id: string) => void;
}

/** Shared role navigation: collapses to an accessible icon rail on desktop and a drawer on mobile. */
export function RoleSidebar({
  ariaLabel,
  roleLabel,
  editionLabel,
  items,
  activeId,
  isOpenMobile = false,
  onCloseMobile,
  onSelect,
}: RoleSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  useModalDismiss(isOpenMobile, () => onCloseMobile?.());

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setCollapsed(current => !current);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const select = (id: string) => {
    onSelect(id);
    onCloseMobile?.();
  };

  return (
    <>
      {isOpenMobile && <button className="role-sidebar-backdrop" aria-label="Đóng menu" onClick={onCloseMobile} />}
      <aside className={`role-sidebar ${collapsed ? 'is-collapsed' : ''} ${isOpenMobile ? 'is-mobile-open' : ''}`} aria-label={ariaLabel}>
        <header className="role-sidebar-header">
          <button className={`role-sidebar-mark ${collapsed ? 'is-clickable' : ''}`} type="button" onClick={() => { if (collapsed) setCollapsed(false); }} aria-label={collapsed ? 'Mở rộng thanh điều hướng' : undefined} title={collapsed ? 'Mở rộng (Ctrl+B)' : undefined}>
            <BookOpen size={18} />
          </button>
          <span className="role-sidebar-heading">
            <strong>ĐƯỜNG SÁCH</strong>
            <small>{roleLabel}</small>
          </span>
          <button className="role-sidebar-toggle" type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} title="Thu gọn/mở rộng (Ctrl+B)">
            <PanelLeft size={17} />
          </button>
          <button className="role-sidebar-close" type="button" onClick={onCloseMobile} aria-label="Đóng menu"><X size={19} /></button>
        </header>

        <nav className="role-sidebar-nav" aria-label="Điều hướng chức năng">
          <p className="role-sidebar-section-label">Không gian làm việc</p>
          {items.map(item => {
            const active = item.id === activeId;
            return (
              <button key={item.id} type="button" className={`role-sidebar-item ${active ? 'is-active' : ''}`} onClick={() => select(item.id)} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined}>
                <span className="role-sidebar-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="role-sidebar-item-label">{item.label}</span>
                {item.badge && item.badge > 0 ? <span className="role-sidebar-item-badge">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>

        <footer className="role-sidebar-footer">
          <span>{editionLabel}</span>
          <small>Ctrl + B để thu gọn</small>
        </footer>
      </aside>
    </>
  );
}
