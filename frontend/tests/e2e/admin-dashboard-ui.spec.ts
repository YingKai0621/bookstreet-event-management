import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, dashboardStatus = 200) {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/auth/csrf') return json(route, { headerName: 'X-XSRF-TOKEN', token: 'test' });
    if (path === '/auth/me') return json(route, { userId: 1, username: 'admin', fullName: 'Quản trị viên', email: 'admin@example.test', emailVerified: true, status: 'ACTIVE', roles: ['ADMIN'] });
    if (path === '/auth/profile') return json(route, { id: 1, fullName: 'Quản trị viên', email: 'admin@example.test', phone: null, avatarUrl: null, emailVerified: true });
    if (path.endsWith('/unread-count')) return json(route, { unreadCount: 0 });
    if (path === '/admin/notifications') return json(route, { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
    if (path === '/admin/audit-logs') return json(route, { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
    if (path === '/admin/dashboard') {
      if (dashboardStatus !== 200) return json(route, { code: dashboardStatus === 403 ? 'ACCESS_DENIED' : 'UNAVAILABLE', message: 'failed' }, dashboardStatus);
      return json(route, {
        accounts: { total: 5, byRole: { PARTICIPANT: 5, PARTNER: 2, ORGANIZER: 1, ADMIN: 1 }, byStatus: { ACTIVE: 4, DISABLED: 1 } },
        events: { total: 3, byStatus: { DRAFT: 1, PUBLISHED: 1, ONGOING: 0, COMPLETED: 1, CANCELLED: 0 } },
        activeBoothAssignments: 0,
        boothRevenue: 1250000,
        auditByDay: [
          { date: '2026-11-03', count: 0 }, { date: '2026-11-04', count: 1 }, { date: '2026-11-05', count: 0 },
          { date: '2026-11-06', count: 2 }, { date: '2026-11-07', count: 0 }, { date: '2026-11-08', count: 0 },
          { date: '2026-11-09', count: 1 },
        ],
      });
    }
    return json(route, { code: 'NOT_FOUND', message: path }, 404);
  });
}

test('dashboard renders the new durable-data contract including genuine zero values', async ({ page }) => {
  await setup(page);
  await page.goto('/admin');
  await expect(page.getByText('5', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1.250.000 ₫')).toBeVisible();
  const boothCard = page.locator('.adm-kpi-card').filter({ hasText: 'Gian hàng đang hoạt động' });
  await expect(boothCard).toContainText('0');
  await expect(page.getByText('Một tài khoản có thể có nhiều vai trò')).toBeVisible();
  await expect(page.getByText('Theo múi giờ Asia/Ho_Chi_Minh')).toBeVisible();
});

test('dashboard failures are visible and never represented as zero', async ({ page }) => {
  await setup(page, 503);
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('Không tải được số liệu tổng quan');
  await expect(page.locator('.adm-kpi-card')).toHaveCount(0);

  const forbidden = await page.context().newPage();
  await setup(forbidden, 403);
  await forbidden.goto('/admin');
  await expect(forbidden.getByRole('alert')).toContainText('không có quyền');
  await expect(forbidden.locator('.adm-kpi-card')).toHaveCount(0);
});
