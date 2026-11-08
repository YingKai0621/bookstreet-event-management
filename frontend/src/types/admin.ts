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
