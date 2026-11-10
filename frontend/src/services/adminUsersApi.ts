import { ApiError } from './apiClient';
import { apiClient } from './apiClient';

/** Sprint 11 API contract sections 4 and 5. Clients branch on status and code, never on message text. */
export type AdminRoleCode = 'PARTICIPANT' | 'PARTNER' | 'ORGANIZER' | 'ADMIN';
export type AdminManageableRole = Exclude<AdminRoleCode, 'PARTICIPANT'>;
export type AdminAccountStatus = 'ACTIVE' | 'DISABLED';
export type AdminUserSort = 'createdAt,desc' | 'createdAt,asc' | 'username,asc' | 'username,desc';

export const ADMIN_ROLE_CODES: AdminRoleCode[] = ['PARTICIPANT', 'PARTNER', 'ORGANIZER', 'ADMIN'];
export const ADMIN_MANAGEABLE_ROLES: AdminManageableRole[] = ['PARTNER', 'ORGANIZER', 'ADMIN'];

export const ADMIN_ROLE_LABELS: Record<AdminRoleCode, string> = {
  PARTICIPANT: 'Người tham gia',
  PARTNER: 'Đối tác',
  ORGANIZER: 'Ban tổ chức',
  ADMIN: 'Quản trị viên',
};

export const ADMIN_ACCOUNT_STATUS_LABELS: Record<AdminAccountStatus, string> = {
  ACTIVE: 'Hoạt động',
  DISABLED: 'Đã khóa',
};

export interface AdminUser {
  userId: number;
  username: string;
  fullName: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  roles: AdminRoleCode[];
  status: AdminAccountStatus;
  createdAt: string;
}

export interface AdminUserPage {
  content: AdminUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminUserQuery {
  page?: number;
  size?: number;
  search?: string;
  role?: AdminRoleCode;
  status?: AdminAccountStatus;
  sort?: AdminUserSort;
}

export interface AdminCreateUserInput {
  username: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  email?: string;
  phone?: string;
}

export interface AdminUpdateUserInput {
  fullName?: string;
  phone?: string;
  email?: string;
}

const userPath = (userId: number) => `/admin/users/${encodeURIComponent(String(userId))}`;

export const adminUsersApi = {
  list(query: AdminUserQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
      sort: query.sort ?? 'createdAt,desc',
    });
    const search = query.search?.trim();
    if (search) params.set('search', search);
    if (query.role) params.set('role', query.role);
    if (query.status) params.set('status', query.status);
    return apiClient.get<AdminUserPage>(`/admin/users?${params}`);
  },
  get: (userId: number) => apiClient.get<AdminUser>(userPath(userId)),
  create: (input: AdminCreateUserInput) => apiClient.post<AdminUser>('/admin/users', input),
  update: (userId: number, input: AdminUpdateUserInput) => apiClient.patch<AdminUser>(userPath(userId), input),
  updateStatus: (userId: number, status: AdminAccountStatus, reason: string) =>
    apiClient.patch<AdminUser>(`${userPath(userId)}/status`, { status, reason }),
  assignRole: (userId: number, role: AdminManageableRole) =>
    apiClient.put<AdminUser>(`${userPath(userId)}/roles/${role}`),
  removeRole: (userId: number, role: AdminManageableRole) =>
    apiClient.delete<AdminUser>(`${userPath(userId)}/roles/${role}`),
};

/** A required reason is 10 to 500 characters after trimming and collapsing whitespace (contract 1.2). */
export function normalizeAdminReason(reason: string): string {
  return reason.trim().replace(/\s+/g, ' ');
}

export function isValidAdminReason(reason: string): boolean {
  const length = Array.from(normalizeAdminReason(reason)).length;
  return length >= 10 && length <= 500;
}

const ERROR_MESSAGES: Record<string, string> = {
  ADMIN_USER_NOT_FOUND: 'Không tìm thấy tài khoản này.',
  USERNAME_ALREADY_EXISTS: 'Tên đăng nhập đã được sử dụng.',
  EMAIL_ALREADY_EXISTS: 'Email đã được tài khoản khác sử dụng.',
  PASSWORD_CONFIRMATION_MISMATCH: 'Mật khẩu xác nhận không khớp.',
  ADMIN_SELF_UPDATE_NOT_ALLOWED: 'Bạn không thể sửa tài khoản của chính mình tại đây. Hãy dùng trang Hồ sơ.',
  VERIFIED_EMAIL_LOCKED: 'Email đã xác minh không thể thay đổi.',
  ADMIN_SELF_LOCK_NOT_ALLOWED: 'Bạn không thể tự khóa tài khoản của mình.',
  LAST_ACTIVE_ADMIN_REQUIRED: 'Hệ thống phải còn ít nhất một Quản trị viên đang hoạt động.',
  ROLE_NOT_MANAGEABLE: 'Vai trò này không thể gán hoặc gỡ.',
  TARGET_ACCOUNT_NOT_ACTIVE: 'Tài khoản đang bị khóa nên không thể gán vai trò.',
  VERIFIED_EMAIL_REQUIRED: 'Tài khoản cần có email đã xác minh trước khi được gán vai trò.',
  ADMIN_SELF_ROLE_REMOVAL_NOT_ALLOWED: 'Bạn không thể tự gỡ vai trò Quản trị viên của mình.',
  ORGANIZER_OWNS_OPEN_EVENTS: 'Người này vẫn sở hữu sự kiện ở trạng thái Nháp, Đã công bố hoặc Đang diễn ra.',
  PARTNER_ORGANIZATION_ACTIVE: 'Người này đang đại diện cho một tổ chức đối tác đang hoạt động. Hãy khóa tổ chức trước.',
  INVALID_FILTER: 'Bộ lọc chưa hợp lệ.',
  INVALID_SORT: 'Cách sắp xếp chưa hợp lệ.',
};

export function adminUserErrorMessage(error: unknown, fallback = 'Thao tác chưa thực hiện được. Vui lòng thử lại.'): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
  if (error.code === 'VALIDATION_FAILED') {
    // Field names from the server are never shown; forms mark the affected fields instead.
    return error.fieldErrors.length > 0
      ? 'Một số thông tin chưa hợp lệ. Vui lòng kiểm tra các ô được đánh dấu.'
      : 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.';
  }
  return fallback;
}

export function adminUserInitials(fullName: string): string {
  return fullName.split(' ').filter(Boolean).map(part => part[0]).slice(-2).join('').toUpperCase();
}
