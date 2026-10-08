import {
  Award,
  Bell,
  Building2,
  History,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  Store,
  User,
  Users
} from 'lucide-react';
import { Language } from '../../types';
import { RoleSidebar } from '../ui/RoleSidebar';

export type AdminTab = 
  | 'venues'
  | 'assets'
  | 'booths'
  | 'dashboard'
  | 'users'
  | 'roles'
  | 'badges'
  | 'settings'
  | 'audit'
  | 'notifications'
  | 'profile';

export interface AdminSidebarProps {
  language: Language;
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  unreadNotificationsCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  language,
  activeTab,
  onSelectTab,
  unreadNotificationsCount = 2,
  isOpenMobile = false,
  onCloseMobile,
  onLogout: _onLogout
}) => {
  const navItems: { id: AdminTab; icon: React.ReactNode; labelVi: string; labelEn: string; badge?: number }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, labelVi: 'Tổng quan', labelEn: 'Dashboard' },
    { id: 'booths', icon: <Store size={18} />, labelVi: 'Danh mục gian hàng', labelEn: 'Booth Catalog' },
    { id: 'venues', icon: <Building2 size={18} />, labelVi: 'Địa điểm tổ chức', labelEn: 'Venues' },
    { id: 'assets', icon: <Package size={18} />, labelVi: 'Thiết bị', labelEn: 'Assets' },
    { id: 'users', icon: <Users size={18} />, labelVi: 'Quản lý người dùng', labelEn: 'User Management' },
    { id: 'roles', icon: <ShieldCheck size={18} />, labelVi: 'Vai trò & Phân quyền', labelEn: 'Roles & Permissions' },
    { id: 'badges', icon: <Award size={18} />, labelVi: 'Quy tắc huy hiệu', labelEn: 'Badge Rules' },
    { id: 'settings', icon: <Settings size={18} />, labelVi: 'Cài đặt hệ thống', labelEn: 'System Settings' },
    { id: 'audit', icon: <History size={18} />, labelVi: 'Nhật ký hệ thống', labelEn: 'Audit Logs' },
    { id: 'notifications', icon: <Bell size={18} />, labelVi: 'Thông báo', labelEn: 'Notifications', badge: unreadNotificationsCount },
    { id: 'profile', icon: <User size={18} />, labelVi: 'Hồ sơ Admin', labelEn: 'Profile' }
  ];

  return <RoleSidebar
    ariaLabel="Điều hướng quản trị viên"
    roleLabel={language === 'vi' ? 'Quản trị viên' : 'Administrator'}
    editionLabel={language === 'vi' ? 'Cổng Quản trị 2026' : 'Admin Portal 2026'}
    items={navItems.map(item => ({ id: item.id, icon: item.icon, label: language === 'vi' ? item.labelVi : item.labelEn, badge: item.badge }))}
    activeId={activeTab}
    isOpenMobile={isOpenMobile}
    onCloseMobile={onCloseMobile}
    onSelect={id => onSelectTab(id as AdminTab)}
  />;
};

