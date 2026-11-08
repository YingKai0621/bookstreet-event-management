import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Language } from '../../types';
import { AdminAuditLogsView } from './AdminAuditLogsView';
import { AdminBadgeRulesView } from './AdminBadgeRulesView';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminNotificationsView } from './AdminNotificationsView';
import { AdminPendingFeatureView } from './AdminPendingFeatureView';
import { AdminProfileView } from './AdminProfileView';
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

import { adminApi } from '../../services/adminApi';
import { adminAuditApi, type AdminAuditLog } from '../../services/adminAuditApi';
import { adminDashboardApi, type AdminDashboardStats } from '../../services/adminDashboardApi';
import { adminUsersApi } from '../../services/adminUsersApi';
import { AdminProfile, AdminUserAccount } from '../../types/admin';

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
  const [users, setUsers] = useState<AdminUserAccount[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AdminAuditLog[]>([]);
  const [recentAuditFailed, setRecentAuditFailed] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState<number | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [profile, setProfile] = useState<AdminProfile>({ id: '', name: '', role: '', department: '', email: '', phone: '', avatarInitials: '', lastLogin: '' });
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats>({ userCount: 0, eventCount: 0, openEventCount: 0, boothCount: 0, activityCount: 0, todayActivityCount: 0, usersByRole: {}, auditByDay: [] });
  const [loadError, setLoadError] = useState('');

  const refreshAdminProfile = useCallback(async () => {
    try {
      setProfile(await adminApi.getProfile());
    } catch {
      if (user) {
        setProfile({
          id: String(user.userId),
          name: user.fullName,
          role: 'ADMIN',
          department: '',
          email: user.email || '',
          phone: '',
          avatarInitials: user.fullName.split(' ').map(part => part[0]).slice(-2).join(''),
          lastLogin: '',
        });
      }
    }
  }, [user]);

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
        const [loadedStats, loadedUsers] = await Promise.all([
          adminDashboardApi.get(),
          adminUsersApi.getUsers(),
        ]);
        setDashboardStats(loadedStats);
        setUsers(loadedUsers);
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
      } else if (activeTab === 'users') {
        setUsers(await adminUsersApi.getUsers());
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

  // --- Handlers: User Management ---
  const handleAddUser = async (newUserData: any) => {
    const rawUsername = newUserData.username || (newUserData.email ? newUserData.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : `user${Date.now()}`);
    const username = (rawUsername.length >= 3 ? rawUsername : `user${rawUsername}`).slice(0, 20);
    await adminUsersApi.createUser({
      username,
      fullName: newUserData.fullName,
      email: newUserData.email,
      phone: newUserData.phone,
      role: newUserData.role,
      status: newUserData.status,
      password: newUserData.password || 'BookStreet@123'
    });
    await refreshAdminData();
  };

  const handleUpdateUser = async (id: string, updates: Partial<AdminUserAccount>) => {
    await adminUsersApi.updateUser(id, { fullName: updates.fullName, phone: updates.phone, role: updates.role, status: updates.status });
    await refreshAdminData();
  };

  const handleToggleLock = async (id: string, reason?: string) => {
    const user = users.find(item => item.id === id);
    if (!user) return;
    await adminUsersApi.updateUserStatus(id, user.status === 'locked' ? 'active' : 'locked', reason);
    await refreshAdminData();
  };

  // --- Handlers: Profile ---
  const handleUpdateProfile = async (updates: Partial<AdminProfile>) => {
    await adminApi.updateProfile({ fullName: updates.name, email: updates.email, phone: updates.phone, avatarUrl: updates.avatarUrl, department: updates.department });
    setProfile(await adminApi.getProfile());
  };

  return (
    <div className="admin-app-shell">
      {/* 1. Full-Width 64px Top Header */}
      <AdminTopBar
        language={language}
        profile={profile}
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
              users={users}
              onOpenAddUser={() => {
                navigateToTab('users');
              }}
            />
          )}

          {activeTab === 'users' && (
            <AdminUserManagementView
              users={users}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onToggleLock={handleToggleLock}
            />
          )}

          {activeTab === 'roles' && (
            <AdminPendingFeatureView
              title="Vai trò"
              description="Gán hoặc gỡ vai trò Đối tác, Ban tổ chức và Quản trị viên cho từng tài khoản."
            />
          )}

          {activeTab === 'organizations' && (
            <AdminPendingFeatureView
              title="Tổ chức đối tác"
              description="Xem tổ chức đối tác và khóa hoặc mở khóa khi cần."
            />
          )}

          {activeTab === 'badges' && (
            <AdminBadgeRulesView />
          )}

          {activeTab === 'audit' && <AdminAuditLogsView />}

          {activeTab === 'notifications' && (
            <AdminNotificationsView
              language={language}
            />
          )}

          {activeTab === 'profile' && (
            <AdminProfileView
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              onChangePassword={adminApi.changePassword}
              onLogout={onLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
};
