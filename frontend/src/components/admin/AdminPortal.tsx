import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Language } from '../../types';
import { AdminAuditLogsView } from './AdminAuditLogsView';
import { AdminBadgeRulesView } from './AdminBadgeRulesView';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminNotificationsView } from './AdminNotificationsView';
import { AdminProfileView } from './AdminProfileView';
import { AdminRolesPermissionsView } from './AdminRolesPermissionsView';
import {
  AdminSidebar,
  AdminTab
} from './AdminSidebar';
import { AdminSystemSettingsView } from './AdminSystemSettingsView';
import { AdminTopBar } from './AdminTopBar';
import { AdminUserManagementView } from './AdminUserManagementView';
import { FacilityManagementView } from './FacilityManagementView';
import { OrganizerBoothManagementView } from '../organizer/OrganizerBoothManagementView';
import { ADMIN_ROOT, ADMIN_TAB_PATHS, resolveAdminTab } from '../../routing/adminRoutes';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../services/apiClient';
import {
  ADMIN_NOTIFICATIONS_CHANGED,
  adminNotificationsApi,
} from '../../services/adminNotificationsApi';

import {
  adminApi,
  AdminDashboardStats,
} from '../../services/adminApi';
import {
  AdminAuditLogItem,
  AdminPermissionItem,
  AdminProfile,
  AdminRolePermissionConfig,
  AdminRoleType,
  AdminSystemSettings,
  AdminUserAccount
} from '../../types/admin';

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
  const [roleConfigs, setRoleConfigs] = useState<Record<AdminRoleType, AdminRolePermissionConfig>>({} as Record<AdminRoleType, AdminRolePermissionConfig>);
  const [permissions, setPermissions] = useState<AdminPermissionItem[]>([]);
  const [systemSettings, setSystemSettings] = useState<AdminSystemSettings>({
    general: { systemName: '', slogan: '', logoUrl: '', supportEmail: '', supportPhone: '', physicalAddress: '', primaryColor: '#059669' },
    security: { minPasswordLength: 8, requireSpecialChar: true, maxFailedAttempts: 5, sessionTimeoutMinutes: 60, twoFactorEnabled: false },
    notifications: { sendWelcomeEmail: true, alertOnFailedLogins: true, notifyRoleChanges: true, dailyDigestEmail: false },
  });
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
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
        const [loadedStats, loadedAuditLogs, loadedUsers] = await Promise.all([
          adminApi.getDashboard(),
          adminApi.getAuditLogs(),
          adminApi.getUsers(),
        ]);
        setDashboardStats(loadedStats);
        setAuditLogs(loadedAuditLogs);
        setUsers(loadedUsers);
      } else if (activeTab === 'users') {
        setUsers(await adminApi.getUsers());
      } else if (activeTab === 'roles') {
        const [loadedRoles, loadedPermissions] = await Promise.all([
          adminApi.getRoles(),
          adminApi.getPermissions(),
        ]);
        setRoleConfigs(loadedRoles);
        setPermissions(loadedPermissions);
      } else if (activeTab === 'settings') {
        setSystemSettings(await adminApi.getSettings());
      } else if (activeTab === 'audit') {
        setAuditLogs(await adminApi.getAuditLogs());
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
    await adminApi.createUser({
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
    await adminApi.updateUser(id, { fullName: updates.fullName, phone: updates.phone, role: updates.role, status: updates.status });
    await refreshAdminData();
  };

  const handleToggleLock = async (id: string, reason?: string) => {
    const user = users.find(item => item.id === id);
    if (!user) return;
    await adminApi.updateUserStatus(id, user.status === 'locked' ? 'active' : 'locked', reason);
    await refreshAdminData();
  };

  const handleResetPassword = async (user: AdminUserAccount) => {
    await adminApi.resetPassword(user.id);
    await refreshAdminData();
  };

  // --- Handlers: Roles & Permissions ---
  const handleSaveRolePermissions = async (roleId: AdminRoleType, permissionCodes: string[]) => {
    await adminApi.saveRolePermissions(roleId, permissionCodes);
    await refreshAdminData();
  };

  const handleResetRoleDefaults = async (_roleId: AdminRoleType) => {
    setRoleConfigs(await adminApi.getRoles());
  };

  // --- Handlers: System Settings ---
  const handleSaveSettings = async (newSettings: AdminSystemSettings) => {
    await adminApi.saveSettings(newSettings);
    await refreshAdminData();
  };

  const handleResetSettings = async () => {
    setSystemSettings(await adminApi.getSettings());
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
          {loadError && <p className="app-loading-state" role="status">Các chức năng quản trị khác đang chờ dữ liệu. Bạn vẫn có thể quản lý gian hàng, địa điểm và thiết bị.</p>}
          {activeTab === 'venues' && <FacilityManagementView key="venues" kind="venues" />}
          {activeTab === 'assets' && <FacilityManagementView key="assets" kind="assets" />}
          {activeTab === 'booths' && <OrganizerBoothManagementView language={language} />}
          {activeTab === 'dashboard' && (
            <AdminDashboardView
              stats={dashboardStats}
              onNavigateTab={(tab) => navigateToTab(tab as AdminTab)}
              auditLogs={auditLogs}
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
              onResetPassword={handleResetPassword}
            />
          )}

          {activeTab === 'roles' && (
            <AdminRolesPermissionsView
              roleConfigs={roleConfigs}
              permissions={permissions}
              onSaveRolePermissions={handleSaveRolePermissions}
              onResetDefaults={handleResetRoleDefaults}
            />
          )}

          {activeTab === 'badges' && (
            <AdminBadgeRulesView />
          )}

          {activeTab === 'settings' && (
            <AdminSystemSettingsView
              settings={systemSettings}
              onSaveSettings={handleSaveSettings}
              onResetSettings={handleResetSettings}
            />
          )}

          {activeTab === 'audit' && (
            <AdminAuditLogsView
              logs={auditLogs}
            />
          )}

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
