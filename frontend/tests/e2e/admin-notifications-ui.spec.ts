import { expect, test, type Page, type Route } from '@playwright/test';

function notificationPage() {
  return { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, options: { listFailure?: boolean; listStatus?: number } = {}) {
  let listRequests = 0;
  let countRequests = 0;

  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) {
      return json(route, {
        userId: 1,
        username: 'admin',
        fullName: 'Admin Test',
        email: 'admin@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        roles: ['ADMIN'],
      });
    }
    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    }
    if (path.endsWith('/admin/profile')) {
      return json(route, {
        id: 1,
        fullName: 'Admin Test',
        email: 'admin@example.com',
        phone: null,
        department: null,
        lastActiveAt: null,
      });
    }
    if (path.endsWith('/admin/settings')) {
      return json(route, [{ key: 'admin.system', value: {
        general: { systemName: 'Book Street', slogan: '', logoUrl: '', supportEmail: '', supportPhone: '', physicalAddress: '', primaryColor: '#059669' },
        security: { minPasswordLength: 8, requireSpecialChar: true, maxFailedAttempts: 5, sessionTimeoutMinutes: 60, twoFactorEnabled: false },
        notifications: { sendWelcomeEmail: true, alertOnFailedLogins: true, notifyRoleChanges: true, dailyDigestEmail: false },
      } }]);
    }
    if (path.endsWith('/admin/dashboard')) {
      return json(route, { accounts: { total: 0, byRole: { PARTICIPANT: 0, PARTNER: 0, ORGANIZER: 0, ADMIN: 0 }, byStatus: { ACTIVE: 0, DISABLED: 0 } }, events: { total: 0, byStatus: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 } }, activeBoothAssignments: 0, boothRevenue: 0, auditByDay: Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-0${index + 1}`, count: 0 })) });
    }
    if (path.endsWith('/admin/badges') || path.endsWith('/admin/users')) return json(route, notificationPage());
    if (path.endsWith('/admin/notifications/unread-count')) {
      countRequests += 1;
      return json(route, { unreadCount: 0 });
    }
    if (path.endsWith('/admin/notifications')) {
      listRequests += 1;
      if (options.listFailure) {
        return json(route, { code: 'UNAVAILABLE', message: 'List failed' }, 503);
      }
      if (options.listStatus) {
        return json(route, { code: 'DENIED', message: 'Denied' }, options.listStatus);
      }
      return json(route, notificationPage());
    }
    return json(route, []);
  });

  return {
    listRequests: () => listRequests,
    countRequests: () => countRequests,
  };
}

test('Admin inbox shows the genuine producer-free empty state', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/admin/notifications');

  await expect(page.getByRole('heading', { name: 'Thông báo quản trị' })).toBeVisible();
  await expect(page.getByText('Hiện chưa có thông báo nào dành cho Admin.')).toBeVisible();
  await expect(page.getByText('An ninh', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tài khoản', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Hệ thống', { exact: true })).toHaveCount(0);
  expect(requests.listRequests()).toBeGreaterThanOrEqual(1);
  expect(requests.countRequests()).toBeGreaterThanOrEqual(1);
});

test('Admin inbox keeps API failure separate from an empty inbox', async ({ page }) => {
  await setup(page, { listFailure: true });
  await page.goto('/admin/notifications');

  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được thông báo' })).toBeVisible();
  await expect(page.getByText('Hiện chưa có thông báo nào dành cho Admin.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeDisabled();
});

test('Admin inbox shows a forbidden response instead of an empty inbox', async ({ page }) => {
  await setup(page, { listStatus: 403 });
  await page.goto('/admin/notifications');

  await expect(page.getByRole('alert').filter({ hasText: 'Bạn không có quyền xem thông báo Admin.' })).toBeVisible();
  await expect(page.getByText('Hiện chưa có thông báo nào dành cho Admin.')).toHaveCount(0);
});

test('an expired Admin session shows sign-in instead of an empty inbox', async ({ page }) => {
  await setup(page, { listStatus: 401 });
  await page.goto('/admin/notifications');

  await expect(page.getByRole('button', { name: /Đăng nhập/ }).first()).toBeVisible();
  await expect(page.getByText('Hiện chưa có thông báo nào dành cho Admin.')).toHaveCount(0);
});

test('opening Badge management does not refresh or clear the Admin inbox', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/admin/notifications');
  await expect(page.getByText('Hiện chưa có thông báo nào dành cho Admin.')).toBeVisible();
  await expect.poll(requests.listRequests).toBeGreaterThanOrEqual(1);
  await expect.poll(requests.countRequests).toBeGreaterThanOrEqual(1);
  await page.waitForLoadState('networkidle');
  const beforeList = requests.listRequests();
  const beforeCount = requests.countRequests();

  await page.getByRole('button', { name: 'Quy tắc huy hiệu' }).click();

  await expect(page).toHaveURL(/\/admin\/badges$/);
  await page.waitForLoadState('networkidle');
  expect(requests.listRequests()).toBe(beforeList);
  expect(requests.countRequests()).toBe(beforeCount);
  await expect(page.getByRole('button', { name: 'Xem thông báo' })).toBeVisible();
});

for (const removed of ['settings', 'venues', 'assets', 'booths']) {
  test(`the removed /admin/${removed} screen leads to the dashboard`, async ({ page }) => {
    await setup(page);
    await page.goto(`/admin/${removed}`);

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('button', { name: 'Tổng quan', exact: true })).toHaveAttribute('aria-current', 'page');
  });
}

test('opening the Admin notification popover performs one bounded refresh', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Quản lý Tài khoản' })).toBeVisible();

  const beforeList = requests.listRequests();
  const beforeCount = requests.countRequests();
  await page.getByRole('button', { name: 'Xem thông báo' }).click();
  await expect(page.getByText('Hiện chưa có thông báo nào dành cho Admin.')).toBeVisible();
  await expect.poll(requests.listRequests).toBe(beforeList + 1);
  await expect.poll(requests.countRequests).toBe(beforeCount + 1);
});
