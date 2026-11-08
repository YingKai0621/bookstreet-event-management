import { expect, test, type Page, type Route } from '@playwright/test';

type Organization = {
  partnerOrganizationId: number;
  name: string;
  description: string;
  categoryCode: string;
  logoUrl: null;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  representative: { userId: number; username: string; fullName: string; accountStatus: 'ACTIVE'; hasPartnerRole: boolean };
  createdAt: string;
  updatedAt: string;
};

const organizations: Organization[] = [
  { partnerOrganizationId: 9, name: 'Nhà sách Mộc Miên', description: 'Đơn vị phát hành', categoryCode: 'PUBLISHER', logoUrl: null,
    contactEmail: 'mocmien@example.test', contactPhone: '0900000000', address: 'Đường Sách TP.HCM', status: 'ACTIVE',
    representative: { userId: 12, username: 'mocmien01', fullName: 'Nguyễn Văn A', accountStatus: 'ACTIVE', hasPartnerRole: true },
    createdAt: '2026-11-01T01:00:00Z', updatedAt: '2026-11-01T01:00:00Z' },
  { partnerOrganizationId: 10, name: 'Nhà sách Đã Khóa', description: '', categoryCode: 'BOOKSTORE', logoUrl: null,
    contactEmail: 'locked@example.test', contactPhone: null, address: null, status: 'INACTIVE',
    representative: { userId: 13, username: 'locked01', fullName: 'Trần Thị B', accountStatus: 'ACTIVE', hasPartnerRole: true },
    createdAt: '2026-11-02T01:00:00Z', updatedAt: '2026-11-03T01:00:00Z' },
];

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, listFailure?: number) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData() as string) : null;
    calls.push({ method, path, body });
    if (path === '/auth/csrf') return json(route, { headerName: 'X-XSRF-TOKEN', token: 'test' });
    if (path === '/auth/me') return json(route, { userId: 1, username: 'admin', fullName: 'Quản trị viên', email: 'admin@example.test', emailVerified: true, status: 'ACTIVE', roles: ['ADMIN'] });
    if (path === '/auth/profile') return json(route, { id: 1, fullName: 'Quản trị viên', email: 'admin@example.test', phone: null, avatarUrl: null, emailVerified: true });
    if (path.endsWith('/unread-count')) return json(route, { unreadCount: 0 });
    if (path === '/admin/notifications') return json(route, { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
    if (path === '/admin/partner-organizations' && method === 'GET') {
      if (listFailure) return json(route, { code: listFailure === 401 ? 'AUTHENTICATION_REQUIRED' : 'ACCESS_DENIED', message: 'Denied' }, listFailure);
      const query = url.searchParams.get('search')?.toLocaleLowerCase('vi-VN') ?? '';
      const status = url.searchParams.get('status');
      const content = organizations.filter(item => (!query || `${item.name} ${item.representative.username} ${item.representative.fullName}`.toLocaleLowerCase('vi-VN').includes(query)) && (!status || item.status === status));
      return json(route, { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0 });
    }
    const detail = path.match(/^\/admin\/partner-organizations\/(\d+)$/);
    if (detail && method === 'GET') return json(route, organizations.find(item => item.partnerOrganizationId === Number(detail[1])));
    const statusChange = path.match(/^\/admin\/partner-organizations\/(\d+)\/status$/);
    if (statusChange && method === 'PATCH') {
      const target = organizations.find(item => item.partnerOrganizationId === Number(statusChange[1]))!;
      target.status = (body as { status: Organization['status'] }).status;
      target.updatedAt = '2026-11-09T01:00:00Z';
      return json(route, target);
    }
    return json(route, { code: 'NOT_FOUND', message: `${method} ${path}` }, 404);
  });
  return calls;
}

test('Admin searches, filters and opens organization detail', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/organizations');
  await expect(page.getByRole('heading', { name: 'Tổ chức đối tác' })).toBeVisible();
  await expect(page.locator('.adm-table tbody tr')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Tìm tổ chức hoặc người đại diện' }).fill('Mộc Miên');
  await expect(page.locator('.adm-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xem chi tiết Nhà sách Mộc Miên' }).click();
  await expect(page.getByRole('dialog', { name: 'Chi tiết tổ chức' })).toContainText('Đường Sách TP.HCM');
  await page.keyboard.press('Escape');
  await page.getByRole('searchbox', { name: 'Tìm tổ chức hoặc người đại diện' }).fill('');
  await page.getByRole('combobox', { name: 'Lọc trạng thái tổ chức' }).selectOption('INACTIVE');
  await expect(page.locator('.adm-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.adm-table tbody tr')).toContainText('Nhà sách Đã Khóa');
});

test('locking requires a normalized reason and updates the server row', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/admin/organizations');
  await page.getByRole('button', { name: 'Khóa Nhà sách Mộc Miên' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Xác nhận' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Lý do *').fill('  Đơn vị   vi phạm quy định trưng bày.  ');
  await confirm.click();
  await expect(page.getByText('Đã khóa tổ chức Nhà sách Mộc Miên.')).toBeVisible();
  expect(calls.find(call => call.method === 'PATCH')?.body).toEqual({ status: 'INACTIVE', reason: 'Đơn vị vi phạm quy định trưng bày.' });
});

test('organization list distinguishes empty, forbidden and expired-session states', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/organizations');
  await page.getByRole('searchbox', { name: 'Tìm tổ chức hoặc người đại diện' }).fill('không tồn tại');
  await expect(page.getByText('Không có tổ chức phù hợp với bộ lọc.')).toBeVisible();

  const forbidden = await page.context().newPage();
  await setup(forbidden, 403);
  await forbidden.goto('/admin/organizations');
  await expect(forbidden.getByRole('alert')).toContainText('không có quyền');

  const expired = await page.context().newPage();
  await setup(expired, 401);
  await expired.goto('/admin/organizations');
  await expect(expired.getByRole('heading', { name: 'Cổng Quản Trị Hệ Thống' })).toBeVisible();
});
