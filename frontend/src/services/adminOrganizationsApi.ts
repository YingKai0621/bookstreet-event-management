import { ApiError, apiClient } from './apiClient';

export type AdminOrganizationStatus = 'ACTIVE' | 'INACTIVE';
export type AdminOrganizationSort = 'name,asc' | 'name,desc' | 'createdAt,desc' | 'createdAt,asc';

export interface AdminPartnerOrganization {
  partnerOrganizationId: number;
  name: string;
  description: string;
  categoryCode: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  status: AdminOrganizationStatus;
  representative: {
    userId: number;
    username: string;
    fullName: string;
    accountStatus: 'ACTIVE' | 'DISABLED';
    hasPartnerRole: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrganizationPage {
  content: AdminPartnerOrganization[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminOrganizationQuery {
  page?: number;
  size?: number;
  search?: string;
  status?: AdminOrganizationStatus;
  sort?: AdminOrganizationSort;
}

export const adminOrganizationsApi = {
  list(query: AdminOrganizationQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
      sort: query.sort ?? 'name,asc',
    });
    const search = query.search?.trim();
    if (search) params.set('search', search);
    if (query.status) params.set('status', query.status);
    return apiClient.get<AdminOrganizationPage>(`/admin/partner-organizations?${params}`);
  },
  detail(organizationId: number) {
    return apiClient.get<AdminPartnerOrganization>(`/admin/partner-organizations/${organizationId}`);
  },
  changeStatus(organizationId: number, status: AdminOrganizationStatus, reason: string) {
    return apiClient.patch<AdminPartnerOrganization>(
      `/admin/partner-organizations/${organizationId}/status`,
      { status, reason },
    );
  },
};

export function normalizeOrganizationReason(reason: string): string {
  return reason.trim().replace(/\s+/g, ' ');
}

export function isValidOrganizationReason(reason: string): boolean {
  const length = Array.from(normalizeOrganizationReason(reason)).length;
  return length >= 10 && length <= 500;
}

export function adminOrganizationError(error: unknown, fallback = 'Thao tác chưa thực hiện được. Vui lòng thử lại.'): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return 'Bạn không có quyền quản lý tổ chức đối tác.';
  if (error.code === 'PARTNER_ORGANIZATION_NOT_FOUND') return 'Không tìm thấy tổ chức đối tác này.';
  if (error.code === 'PARTNER_ROLE_REQUIRED') return 'Người đại diện cần có vai trò Đối tác trước khi mở khóa tổ chức.';
  if (error.code === 'INVALID_FILTER') return 'Bộ lọc chưa hợp lệ.';
  if (error.code === 'INVALID_SORT') return 'Cách sắp xếp chưa hợp lệ.';
  if (error.code === 'VALIDATION_FAILED') return 'Lý do phải có từ 10 đến 500 ký tự.';
  return fallback;
}
