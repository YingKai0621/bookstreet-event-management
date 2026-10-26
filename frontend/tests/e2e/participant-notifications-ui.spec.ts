import { expect, test, type Page, type Route } from '@playwright/test';

const notification = {
  notificationId: 801,
  type: 'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED',
  title: 'Lịch hoạt động đã thay đổi',
  message: 'Hoạt động Giao lưu tác giả trẻ đã được cập nhật.',
  referenceType: 'ACTIVITY',
  referenceId: 91,
  createdAt: '2026-10-20T08:00:00Z',
  readAt: null as string | null,
  read: false,
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockParticipant(page: Page): Promise<{ markReadRequests: () => number }> {
  let read = false;
  let markReadRequestCount = 0;

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith('/auth/me')) {
      return json(route, {
        userId: 42,
        username: 'participantdemo',
        fullName: 'Bạn đọc Demo',
        email: null,
        emailVerified: false,
        status: 'ACTIVE',
        roles: ['PARTICIPANT'],
      });
    }
    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    }
    if (path.endsWith('/auth/profile')) {
      return json(route, { id: 42, fullName: 'Bạn đọc Demo', email: null, phone: null, avatarUrl: null });
    }
    if (path === '/api/v1/participant/notifications' && method === 'GET') {
      const item = { ...notification, read, readAt: read ? '2026-10-26T01:00:00Z' : null };
      return json(route, { content: [item], page: 0, size: 20, totalElements: 1, totalPages: 1 });
    }
    if (path === '/api/v1/participant/notifications/unread-count') {
      return json(route, { unreadCount: read ? 0 : 1 });
    }
    if (path === '/api/v1/participant/notifications/801/read' && method === 'POST') {
      expect(route.request().headers()['x-csrf-token']).toBe('test-token');
      markReadRequestCount += 1;
      read = true;
      return json(route, { ...notification, read: true, readAt: '2026-10-26T01:00:00Z' });
    }
    if (path === '/api/v1/events') {
      return json(route, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    }
    if (path.startsWith('/api/v1/participant/')) return json(route, []);
    return json(route, []);
  });

  return { markReadRequests: () => markReadRequestCount };
}

test('paged participant notifications render without blanking the portal and mark one as read', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const { markReadRequests } = await mockParticipant(page);

  await page.goto('/participant');
  await expect(page.locator('body')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Thông báo' }).click();
  await expect(page.getByText('Lịch hoạt động đã thay đổi')).toBeVisible();
  await expect(page.getByText('1 thông báo mới')).toBeVisible();
  await expect(page.getByRole('button', { name: /Đã đọc tất cả|Mark all read/ })).toHaveCount(0);

  await page.locator('.notif-dropdown-item').click();
  await expect.poll(markReadRequests).toBe(1);
  await expect(page).toHaveURL('/participant/activities/detail/91');
  expect(pageErrors).toEqual([]);
});
