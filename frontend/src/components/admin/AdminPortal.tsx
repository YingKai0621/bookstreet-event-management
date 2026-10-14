import React, { useEffect, useState } from 'react';
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

import {
  adminApi,
  AdminDashboardStats,
} from '../../services/adminApi';
import {
  AdminAuditLogItem,
  AdminBadgeRule,
  AdminNotificationItem,
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
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const saved = localStorage.getItem('admin_active_tab') as AdminTab | null;
    return saved || 'dashboard';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core Data States
  const [users, setUsers] = useState<AdminUserAccount[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<Record<AdminRoleType, AdminRolePermissionConfig>>({} as Record<AdminRoleType, AdminRolePermissionConfig>);
  const [permissions, setPermissions] = useState<AdminPermissionItem[]>([]);
  const [badgeRules, setBadgeRules] = useState<AdminBadgeRule[]>([]);
  const [systemSettings, setSystemSettings] = useState<AdminSystemSettings>({
    general: { systemName: '', slogan: '', logoUrl: '', supportEmail: '', supportPhone: '', physicalAddress: '', primaryColor: '#059669' },
    security: { minPasswordLength: 8, requireSpecialChar: true, maxFailedAttempts: 5, sessionTimeoutMinutes: 60, twoFactorEnabled: false },
    notifications: { sendWelcomeEmail: true, alertOnFailedLogins: true, notifyRoleChanges: true, dailyDigestEmail: false },
  });
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [profile, setProfile] = useState<AdminProfile>({ id: '', name: '', role: '', department: '', email: '', phone: '', avatarInitials: '', lastLogin: '' });
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats>({ userCount: 0, eventCount: 0, openEventCount: 0, boothCount: 0, activityCount: 0, todayActivityCount: 0, usersByRole: {}, auditByDay: [] });
  const [loadError, setLoadError] = useState('');

  // Persist activeTab on changes
  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);
  }, [activeTab]);

  const refreshAdminData = async () => {
    try {
      const [
        loadedRoles,
        loadedPermissions,
        loadedProfile,
        loadedUsers,
        loadedStats,
        loadedAuditLogs,
        loadedBadges,
        loadedNotifications
      ] = await Promise.all([
        adminApi.getRoles().catch(() => ({} as Record<AdminRoleType, AdminRolePermissionConfig>)),
        adminApi.getPermissions().catch(() => []),
        adminApi.getProfile().catch(() => ({ id: '', name: 'Quản trị viên', role: 'ADMIN', department: '', email: '', phone: '', avatarInitials: 'AD', lastLogin: '' })),
        adminApi.getUsers().catch(() => []),
        adminApi.getDashboard().catch(() => ({ userCount: 0, eventCount: 0, openEventCount: 0, boothCount: 0, activityCount: 0, todayActivityCount: 0, usersByRole: {}, auditByDay: [] })),
        adminApi.getAuditLogs().catch(() => []),
        adminApi.getBadgeRules().catch(() => []),
        adminApi.getNotifications().catch(() => [])
      ]);

      setRoleConfigs(loadedRoles);
      setPermissions(loadedPermissions);
      setProfile(loadedProfile);
      setUsers(loadedUsers);
      setDashboardStats(loadedStats);
      setAuditLogs(loadedAuditLogs);
      setBadgeRules(loadedBadges);
      setNotifications(loadedNotifications);
      setLoadError('');
    } catch (error) {
      console.warn(error);
      setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu quản trị');
    }
  };

  useEffect(() => {
    void refreshAdminData();
    const refresh = () => void refreshAdminData().catch(console.warn);
    const intervalId = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(intervalId); window.removeEventListener('focus', refresh); };
  }, []);

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

  // --- Handlers: Badge Rules ---
  const handleAddBadgeRule = async (newRuleData: Omit<AdminBadgeRule, 'id'>) => {
    await adminApi.createBadgeRule(newRuleData);
    await refreshAdminData();
  };

  const handleUpdateBadgeRule = async (id: string, updates: Partial<AdminBadgeRule>) => {
    await adminApi.updateBadgeRule(id, updates);
    await refreshAdminData();
  };

  const handleToggleBadgeStatus = async (id: string) => {
    const rule = badgeRules.find(item => item.id === id);
    if (!rule) return;
    await adminApi.updateBadgeRule(id, { status: rule.status === 'active' ? 'inactive' : 'active' });
    await refreshAdminData();
  };

  // --- Handlers: System Settings ---
  const handleSaveSettings = async (newSettings: AdminSystemSettings) => {
    await adminApi.saveSettings(newSettings);
    await refreshAdminData();
  };

  const handleResetSettings = async () => {
    setSystemSettings(await adminApi.getSettings());
  };

  // --- Handlers: Notifications ---
  const handleMarkAllNotifsAsRead = async () => {
    await adminApi.markAllNotificationsRead();
    setNotifications(await adminApi.getNotifications());
  };

  const handleMarkNotifAsRead = async (id: string) => {
    await adminApi.markNotificationRead(id);
    setNotifications(await adminApi.getNotifications());
  };

  // --- Handlers: Profile ---
  const handleUpdateProfile = async (updates: Partial<AdminProfile>) => {
    await adminApi.updateProfile({ fullName: updates.name, email: updates.email, phone: updates.phone, avatarUrl: updates.avatarUrl, department: updates.department });
    setProfile(await adminApi.getProfile());
  };

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="admin-app-shell">
      {/* 1. Full-Width 64px Top Header */}
      <AdminTopBar
        language={language}
        profile={profile}
        unreadCount={unreadNotificationsCount}
        notifications={notifications}
        onMarkAllNotifsRead={handleMarkAllNotifsAsRead}
        onMarkNotifRead={handleMarkNotifAsRead}
        onOpenNotifications={() => setActiveTab('notifications')}
        onOpenProfile={() => setActiveTab('profile')}
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
            setActiveTab(tab);
            setIsMobileSidebarOpen(false);
          }}
          unreadNotificationsCount={unreadNotificationsCount}
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
              onNavigateTab={(tab) => setActiveTab(tab as AdminTab)}
              auditLogs={auditLogs}
              users={users}
              onOpenAddUser={() => {
                setActiveTab('users');
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
            <AdminBadgeRulesView
              badgeRules={badgeRules}
              onAddBadgeRule={handleAddBadgeRule}
              onUpdateBadgeRule={handleUpdateBadgeRule}
              onToggleBadgeStatus={handleToggleBadgeStatus}
            />
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
              notifications={notifications}
              onMarkAllAsRead={handleMarkAllNotifsAsRead}
              onMarkAsRead={handleMarkNotifAsRead}
              onNavigateTab={(tab) => setActiveTab(tab as AdminTab)}
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
