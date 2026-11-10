import {
  Building2,
  Bell,
  CalendarDays,
  Layers,
  Landmark,
  LayoutDashboard,
  MessageSquare,
  CreditCard,
  Store,
  User,
  Users
} from 'lucide-react';
import { Language } from '../../types';
import type { OrganizerTab } from '../../types/organizer';
import { RoleSidebar } from '../ui/RoleSidebar';

export type { OrganizerTab } from '../../types/organizer';

export interface OrganizerSidebarProps {
  language: Language;
  activeTab: OrganizerTab;
  onSelectTab: (tab: OrganizerTab) => void;
  unreadNotificationsCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export const OrganizerSidebar: React.FC<OrganizerSidebarProps> = ({
  language,
  activeTab,
  onSelectTab,
  unreadNotificationsCount = 0,
  isOpenMobile = false,
  onCloseMobile,
  onLogout: _onLogout
}) => {
  const navItems = [
    { id: 'overview' as OrganizerTab, icon: <LayoutDashboard size={18} />, labelVi: 'Dashboard', labelEn: 'Dashboard' },
    { id: 'events' as OrganizerTab, icon: <CalendarDays size={18} />, labelVi: 'Sự kiện', labelEn: 'Events' },
    { id: 'booth_requests' as OrganizerTab, icon: <Store size={18} />, labelVi: 'Yêu cầu gian hàng', labelEn: 'Booth Requests' },
    { id: 'payments' as OrganizerTab, icon: <CreditCard size={18} />, labelVi: 'Lịch sử thanh toán', labelEn: 'Payment History' },
    { id: 'booths' as OrganizerTab, icon: <Store size={18} />, labelVi: 'Gian hàng', labelEn: 'Booths' },
    { id: 'venues' as OrganizerTab, icon: <Building2 size={18} />, labelVi: 'Địa điểm tổ chức', labelEn: 'Venues' },
    { id: 'activities' as OrganizerTab, icon: <Layers size={18} />, labelVi: 'Hoạt động', labelEn: 'Activities' },
    { id: 'participants' as OrganizerTab, icon: <Users size={18} />, labelVi: 'Người tham gia', labelEn: 'Participants' },
    { id: 'feedback' as OrganizerTab, icon: <MessageSquare size={18} />, labelVi: 'Góp ý', labelEn: 'Feedback' },
    { id: 'notifications' as OrganizerTab, icon: <Bell size={18} />, labelVi: 'Thông báo', labelEn: 'Notifications', badge: unreadNotificationsCount },
    { id: 'public_content' as OrganizerTab, icon: <Landmark size={18} />, labelVi: 'Di sản', labelEn: 'Heritage' },
    { id: 'profile' as OrganizerTab, icon: <User size={18} />, labelVi: 'Hồ sơ Organizer', labelEn: 'Profile' }
  ];

  return <RoleSidebar
    ariaLabel="Điều hướng ban quản lý"
    roleLabel={language === 'vi' ? 'Ban quản lý' : 'Organizer'}
    editionLabel={language === 'vi' ? 'Cổng Ban quản lý 2026' : 'Management Portal 2026'}
    items={navItems.map(item => ({ id: item.id, icon: item.icon, label: language === 'vi' ? item.labelVi : item.labelEn, badge: item.badge }))}
    activeId={activeTab === 'event_detail' ? 'events' : activeTab}
    isOpenMobile={isOpenMobile}
    onCloseMobile={onCloseMobile}
    onSelect={id => onSelectTab(id as OrganizerTab)}
  />;
};
