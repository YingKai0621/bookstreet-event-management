import { expect, test, type Page, type Route } from '@playwright/test';

function notificationPage() {
  return { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, options: { listFailure?: boolean } = {}) {
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
    if (path.endsWith('/admin/notifications/unread-count')) {
      countRequests += 1;
      return json(route, { unreadCount: 0 });
    }
    if (path.endsWith('/admin/notifications')) {
      listRequests += 1;
      if (options.listFailure) {
        return json(route, { code: 'UNAVAILABLE', message: 'List failed' }, 503);
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
