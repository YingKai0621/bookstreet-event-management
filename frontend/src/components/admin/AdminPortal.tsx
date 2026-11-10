import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Language } from '../../types';
import { AdminAuditLogsView } from './AdminAuditLogsView';
import { AdminBadgeRulesView } from './AdminBadgeRulesView';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminNotificationsView } from './AdminNotificationsView';
import { AdminPaymentsView } from './AdminPaymentsView';
import { AdminOrganizationsView } from './AdminOrganizationsView';
import { AdminProfileView } from './AdminProfileView';
import { AdminRolesView } from './AdminRolesView';
import {
  AdminSidebar,
  AdminTab
} from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';
import { AdminUserManagementView } from './AdminUserManagementView';
import { ADMIN_ROOT, ADMIN_TAB_PATHS, resolveAdminTab } from '../../routing/adminRoutes';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../services/apiClient';
import {
  ADMIN_NOTIFICATIONS_CHANGED,
  adminNotificationsApi,
} from '../../services/adminNotificationsApi';

import { adminAuditApi, type AdminAuditLog } from '../../services/adminAuditApi';
import { adminDashboardApi, type AdminDashboardStats } from '../../services/adminDashboardApi';
import { adminProfileApi, type AdminProfileUpdate } from '../../services/adminProfileApi';
import { AdminProfile } from '../../types/admin';

import './AdminPortal.css';
import './AdminVisualRefresh.css';

export interface AdminPortalProps {
  language: Language;
  onLogout: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  language,
  onLogout
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const resolvedTab = resolveAdminTab(location.pathname);
  const activeTab: AdminTab = resolvedTab ?? 'dashboard';
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!resolvedTab) navigate(ADMIN_ROOT, { replace: true });
  }, [navigate, resolvedTab]);

  const navigateToTab = (tab: AdminTab) => navigate(ADMIN_TAB_PATHS[tab]);

  // Core Data States
  const [recentAuditLogs, setRecentAuditLogs] = useState<AdminAuditLog[]>([]);
  const [recentAuditFailed, setRecentAuditFailed] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState<number | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats>({ requestState: 'loading' });
  const [loadError, setLoadError] = useState('');

  const refreshAdminProfile = useCallback(async () => {
    setProfileError('');
    try {
      setProfile(await adminProfileApi.get());
    } catch (error) {
      setProfileError(error instanceof ApiError && error.status === 401
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : 'Không tải được hồ sơ. Vui lòng thử lại.');
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    setNotificationLoading(true);
    setNotificationError('');
    try {
      const [page, count] = await Promise.all([
        adminNotificationsApi.list({ page: 0, size: 5 }),
        adminNotificationsApi.unreadCount(),
      ]);
      if (!Array.isArray(page.content)
          || page.content.length !== 0
          || page.totalElements !== 0
          || count.unreadCount !== 0) {
        throw new Error('Invalid Admin notification response');
      }
      setNotificationUnreadCount(count.unreadCount);
    } catch (error) {
      setNotificationUnreadCount(null);
      setNotificationError(error instanceof ApiError && error.status === 401
        ? 'Phiên đăng nhập đã hết hạn.'
        : error instanceof ApiError && error.status === 403
          ? 'Bạn không có quyền xem thông báo Admin.'
          : 'Không tải được thông báo.');
    } finally {
      setNotificationLoading(false);
    }
  }, []);

  const refreshAdminData = useCallback(async () => {
    try {
      if (activeTab === 'dashboard') {
        const loadedStats = await adminDashboardApi.get();
        setDashboardStats(loadedStats);
        // A failure here must not hide the other figures, and must not read as no activity.
        try {
          const recent = await adminAuditApi.list({ size: 5 });
          if (!Array.isArray(recent.content)) throw new Error('Invalid audit response');
          setRecentAuditLogs(recent.content);
          setRecentAuditFailed(false);
        } catch {
          setRecentAuditLogs([]);
          setRecentAuditFailed(true);
        }
      }
      setLoadError('');
    } catch (error) {
      console.warn(error);
      setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu quản trị');
    }
  }, [activeTab]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Admin chrome data is synchronized with the active route by this async loader.
    void refreshAdminProfile();
  }, [refreshAdminProfile]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Workspace entry synchronizes the role-scoped Admin preview and badge.
    void refreshNotifications();
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED, refreshNotifications);
    return () => window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED, refreshNotifications);
  }, [refreshNotifications]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Route-specific admin data is loaded by this async boundary.
    void refreshAdminData();
  }, [refreshAdminData]);

  // The top bar shows the signed-in account until the profile has loaded.
  const topBarProfile: AdminProfile = profile ?? {
    id: String(user?.userId ?? ''),
    name: user?.fullName ?? '',
    email: user?.email ?? '',
    emailVerified: user?.emailVerified ?? false,
    phone: '',
    avatarInitials: (user?.fullName ?? '').split(' ').filter(Boolean).map(part => part[0]).slice(-2).join('').toUpperCase(),
  };

  // --- Handlers: Profile ---
  const handleUpdateProfile = async (update: AdminProfileUpdate) => {
    setProfile(await adminProfileApi.update(update));
  };

  return (
    <div className="admin-app-shell">
      {/* 1. Full-Width 64px Top Header */}
      <AdminTopBar
        language={language}
        profile={topBarProfile}
        unreadCount={notificationUnreadCount}
        notificationLoading={notificationLoading}
        notificationError={notificationError}
        onNotificationPopoverOpen={() => { void refreshNotifications(); }}
        onOpenNotifications={() => navigateToTab('notifications')}
        onOpenProfile={() => navigateToTab('profile')}
        onLogout={onLogout}
        onOpenMobileMenu={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* 2. Body container with sticky sidebar + main content */}
      <div className="admin-body-container">
        {/* Sticky 250px Sidebar */}
        <AdminSidebar
          language={language}
          activeTab={activeTab}
          onSelectTab={(tab: AdminTab) => {
            navigateToTab(tab);
            setIsMobileSidebarOpen(false);
          }}
          unreadNotificationsCount={notificationUnreadCount ?? 0}
          onLogout={onLogout}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Spacious Main Viewport */}
        <main className="admin-main-viewport">
          {loadError && <p className="app-loading-state" role="status">Không tải được dữ liệu của trang này. Vui lòng thử lại sau.</p>}
          {activeTab === 'dashboard' && (
            <AdminDashboardView
              stats={dashboardStats}
              onNavigateTab={(tab) => navigateToTab(tab as AdminTab)}
              auditLogs={recentAuditLogs}
              auditLogsFailed={recentAuditFailed}
              onOpenAddUser={() => {
                navigateToTab('users');
              }}
            />
          )}

          {activeTab === 'users' && (
            <AdminUserManagementView />
          )}

          {activeTab === 'roles' && <AdminRolesView />}

          {activeTab === 'organizations' && <AdminOrganizationsView />}

          {activeTab === 'badges' && (
            <AdminBadgeRulesView />
          )}

          {activeTab === 'payments' && <AdminPaymentsView />}

          {activeTab === 'audit' && <AdminAuditLogsView />}

          {activeTab === 'notifications' && (
            <AdminNotificationsView
              language={language}
            />
          )}

          {activeTab === 'profile' && (
            <AdminProfileView
              profile={profile}
              loadError={profileError}
              onRetry={() => { void refreshAdminProfile(); }}
              onUpdateProfile={handleUpdateProfile}
              onLogout={onLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
};
