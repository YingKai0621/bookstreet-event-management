export type AdminRoleType = 'participant' | 'partner' | 'organizer' | 'admin';
export type AdminAccountStatus = 'active' | 'locked' | 'pending_verification';

export interface AdminUserAccount {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string;
  role: AdminRoleType;
  roleLabelVi: string;
  status: AdminAccountStatus;
  statusLabelVi: string;
  lastActive: string;
  createdDate: string;
  lockReason?: string;
  avatarInitials: string;
}

export interface AdminPermissionItem {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  description: string;
  module: 'account' | 'events' | 'booths' | 'activities' | 'content' | 'reports' | 'system';
  moduleLabelVi: string;
}

export interface AdminRolePermissionConfig {
  roleId: AdminRoleType;
  roleName: string;
  description: string;
  assignedPermissionCodes: string[];
}

export interface AdminBadgeRule {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  iconType: 'seedling' | 'book' | 'award' | 'crown';
  pointsThreshold: number;
  status: 'active' | 'inactive';
  statusLabelVi: string;
  description: string;
  descriptionEn: string;
  perks: string[];
}

export interface AdminSystemSettings {
  general: {
    systemName: string;
    slogan: string;
    logoUrl: string;
    supportEmail: string;
    supportPhone: string;
    physicalAddress: string;
    primaryColor: string;
  };
  security: {
    minPasswordLength: number;
    requireSpecialChar: boolean;
    maxFailedAttempts: number;
    sessionTimeoutMinutes: number;
    twoFactorEnabled: boolean;
  };
  notifications: {
    sendWelcomeEmail: boolean;
    alertOnFailedLogins: boolean;
    notifyRoleChanges: boolean;
    dailyDigestEmail: boolean;
  };
}

export interface AdminAuditLogItem {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  actionType: 'create' | 'update' | 'delete' | 'lock' | 'unlock' | 'permission' | 'config';
  actionLabelVi: string;
  targetObject: string;
  details: string;
  status: 'success' | 'warning' | 'failed';
  ipAddress: string;
}

export interface AdminProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  avatarInitials: string;
  avatarUrl?: string;
  lastLogin: string;
}
