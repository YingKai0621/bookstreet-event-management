import { apiClient } from './apiClient';

export const ADMIN_AUDIT_ACTION_LABELS = {
  USER_CREATED: 'Tạo tài khoản',
  USER_UPDATED: 'Cập nhật tài khoản',
  USER_LOCKED: 'Khóa tài khoản',
  USER_UNLOCKED: 'Mở khóa tài khoản',
  ROLE_ASSIGNED: 'Gán vai trò',
  ROLE_REMOVED: 'Gỡ vai trò',
  ORGANIZATION_LOCKED: 'Khóa tổ chức đối tác',
  ORGANIZATION_UNLOCKED: 'Mở khóa tổ chức đối tác',
  BADGE_CREATED: 'Tạo huy hiệu',
  BADGE_UPDATED: 'Cập nhật huy hiệu',
  BADGE_AWARDS_SYNCHRONIZED: 'Đồng bộ cấp huy hiệu',
} as const;

export const ADMIN_AUDIT_TARGET_LABELS = {
  USER: 'Tài khoản',
  PARTNER_ORGANIZATION: 'Tổ chức đối tác',
  BADGE: 'Huy hiệu',
} as const;

export type AdminAuditAction = keyof typeof ADMIN_AUDIT_ACTION_LABELS;
export type AdminAuditTargetType = keyof typeof ADMIN_AUDIT_TARGET_LABELS;

export interface AdminAuditLog {
  auditLogId: number;
  actor: { userId: number; username: string; fullName: string };
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: number;
  targetLabel: string;
  reason: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuditQuery {
  page?: number;
  size?: number;
  actorUserId?: string;
  action?: AdminAuditAction;
  targetType?: AdminAuditTargetType;
  targetId?: string;
  from?: string;
  to?: string;
}

export interface AdminAuditPage {
  content: AdminAuditLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const adminAuditApi = {
  list(query: AdminAuditQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
    });
    for (const key of ['actorUserId', 'action', 'targetType', 'targetId', 'from', 'to'] as const) {
      const value = query[key];
      if (value) params.set(key, value);
    }
    return apiClient.get<AdminAuditPage>(`/admin/audit-logs?${params}`);
  },
};

export function formatAuditTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
}
