import { expect, test, type Page, type Route } from '@playwright/test';

const participant = {
  userId: 42,
  username: 'notificationreader',
  fullName: 'Độc giả Thông báo',
  email: 'notification-reader@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT'],
};

type NotificationType =
  | 'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED'
  | 'ACTIVITY_CANCELLED'
  | 'EVENT_CANCELLED'
  | 'CERTIFICATE_ISSUED'
  | 'CERTIFICATE_REVOKED';

interface MockNotification {
  notificationId: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: 'EVENT' | 'ACTIVITY' | 'CERTIFICATE';
  referenceId: number;
  createdAt: string;
  readAt: string | null;
  read: boolean;
}

const types: NotificationType[] = [
  'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED',
  'ACTIVITY_CANCELLED',
  'EVENT_CANCELLED',
  'CERTIFICATE_ISSUED',
  'CERTIFICATE_REVOKED',
];

function createNotifications(): MockNotification[] {
  return Array.from({ length: 12 }, (_, index) => ({
    notificationId: index + 1,
    type: types[index % types.length],
    title: `Thông báo kiểm thử ${String(index + 1).padStart(2, '0')}`,
    message: `Nội dung cập nhật số ${index + 1}`,
    referenceType: index % 3 === 0 ? 'EVENT' : index % 3 === 1 ? 'ACTIVITY' : 'CERTIFICATE',
    referenceId: index % 3 === 0 ? 746 : index % 3 === 1 ? 91 : 501,
    createdAt: `2026-10-${String(26 - index).padStart(2, '0')}T01:00:00Z`,
    readAt: index % 2 === 0 ? null : '2026-10-26T02:00:00Z',
    read: index % 2 !== 0,
  }));
}

function pageOf<T>(content: T[], page: number, size: number, totalElements = content.length) {
  return {
    content,
    page,
    size,
    totalElements,
    totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / size),
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockNotifications(
  page: Page,
  options: { failFirstPage?: boolean; failFirstRead?: boolean } = {},
) {
  let notifications = createNotifications();
  let fullPageFailures = options.failFirstPage ? 1 : 0;
  let readFailures = options.failFirstRead ? 1 : 0;
  const requests: Array<{ method: string; path: string; query: URLSearchParams }> = [];

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    requests.push({ method, path, query: new URLSearchParams(url.searchParams) });

    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'notification-csrf' });
    if (path.endsWith('/auth/me')) return json(route, participant);
    if (path.endsWith('/auth/profile')) return json(route, {
      id: participant.userId,
      fullName: participant.fullName,
      email: participant.email,
      emailVerified: true,
      phone: null,
      avatarUrl: null,
    });
    if (path === '/api/v1/participant/event-registrations' || path === '/api/v1/participant/activity-registrations') {
      return json(route, pageOf([], 0, 100, 0));
    }
    if (path === '/api/v1/participant/notifications/unread-count') {
      return json(route, { unreadCount: notifications.filter(item => !item.read).length });
    }
    if (path === '/api/v1/participant/notifications' && method === 'GET') {
      const requestedPage = Number(url.searchParams.get('page') || 0);
      const size = Number(url.searchParams.get('size') || 20);
      if (size === 10 && fullPageFailures > 0) {
        fullPageFailures -= 1;
        return json(route, { code: 'TEMPORARILY_UNAVAILABLE', message: 'Dịch vụ thông báo đang bận.' }, 503);
      }
      const read = url.searchParams.get('read');
      const type = url.searchParams.get('type');
      const filtered = notifications.filter(item => (read === null || item.read === (read === 'true'))
        && (type === null || item.type === type));
      const start = requestedPage * size;
      return json(route, pageOf(filtered.slice(start, start + size), requestedPage, size, filtered.length));
    }
    if (path === '/api/v1/participant/notifications/read-all' && method === 'POST') {
      const updatedCount = notifications.filter(item => !item.read).length;
      notifications = notifications.map(item => ({
        ...item,
        read: true,
        readAt: item.readAt || '2026-10-26T03:00:00Z',
      }));
      return json(route, { updatedCount });
    }
    const readMatch = path.match(/\/api\/v1\/participant\/notifications\/(\d+)\/read$/);
    if (readMatch && method === 'POST') {
      if (readFailures > 0) {
        readFailures -= 1;
        return json(route, { code: 'TEMPORARILY_UNAVAILABLE', message: 'Chưa thể cập nhật thông báo.' }, 503);
      }
      const id = Number(readMatch[1]);
      notifications = notifications.map(item => item.notificationId === id
        ? { ...item, read: true, readAt: '2026-10-26T03:00:00Z' }
        : item);
      return json(route, notifications.find(item => item.notificationId === id));
    }
    return json(route, []);
  });

  return requests;
}

test('notification workspace uses backend pagination and filters without polling', async ({ page }) => {
  const requests = await mockNotifications(page);
  await page.goto('/participant/notifications');

  await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible();
  await expect(page.locator('.participant-notification-card')).toHaveCount(10);
  await page.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect(page.locator('.participant-notification-card')).toHaveCount(2);

  await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click();
  await expect(page.locator('.participant-notification-card')).toHaveCount(6);
  await page.getByLabel('Loại thông báo').selectOption('ACTIVITY_CANCELLED');
  await expect(page.locator('.participant-notification-card')).toHaveCount(1);

  const fullPageRequests = () => requests.filter(entry => entry.path === '/api/v1/participant/notifications'
    && entry.query.get('size') === '10');
  const latest = fullPageRequests().at(-1);
  expect(latest?.query.get('read')).toBe('false');
  expect(latest?.query.get('type')).toBe('ACTIVITY_CANCELLED');
  expect(latest?.query.get('sort')).toBe('createdAt,desc');
  const requestCount = requests.length;
  await page.waitForTimeout(1_100);
  expect(requests.length).toBe(requestCount);
});

test('marking one notification as read updates the card and sidebar badge', async ({ page }) => {
  const requests = await mockNotifications(page);
  await page.goto('/participant/notifications');

  const sidebarItem = page.locator('.role-sidebar-item').filter({ hasText: 'Thông báo' });
  await expect(sidebarItem.locator('.role-sidebar-item-badge')).toHaveText('6');
  const notificationCard = page.locator('.participant-notification-card').first();
  await expect(notificationCard).toHaveClass(/is-unread/);
  await notificationCard.getByRole('button', { name: 'Đã đọc', exact: true }).click();
  await expect(notificationCard).toHaveClass(/is-read/);
  await expect(sidebarItem.locator('.role-sidebar-item-badge')).toHaveText('5');
  expect(requests.some(entry => entry.method === 'POST'
    && /\/participant\/notifications\/\d+\/read$/.test(entry.path))).toBe(true);
});

test('mark all as read clears unread results and the shared badge', async ({ page }) => {
  const requests = await mockNotifications(page);
  await page.goto('/participant/notifications');

  await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click();
  await expect(page.locator('.participant-notification-card.is-unread')).toHaveCount(0);
  await expect(page.locator('.role-sidebar-item-badge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click();
  await expect(page.getByText('Không có kết quả phù hợp')).toBeVisible();
  expect(requests.some(entry => entry.method === 'POST'
    && entry.path === '/api/v1/participant/notifications/read-all')).toBe(true);
});

test('list and mark-read failures provide recoverable UI', async ({ page }) => {
  await mockNotifications(page, { failFirstPage: true, failFirstRead: true });
  await page.goto('/participant/notifications');

  await expect(page.getByRole('alert')).toContainText('Dịch vụ thông báo đang bận.');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  const notificationCard = page.locator('.participant-notification-card').first();
  await expect(notificationCard).toHaveClass(/is-unread/);
  await notificationCard.getByRole('button', { name: 'Đã đọc', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa thể cập nhật thông báo.');
  await notificationCard.getByRole('button', { name: 'Đã đọc', exact: true }).click();
  await expect(notificationCard).toHaveClass(/is-read/);
});

test('bell dropdown is a five-item preview linking to the notification workspace', async ({ page }) => {
  await mockNotifications(page);
  await page.goto('/participant');
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  const dropdown = page.getByRole('dialog', { name: 'Thông báo gần đây' });
  await expect(dropdown.locator('.notif-dropdown-item')).toHaveCount(5);
  await dropdown.getByRole('link', { name: 'Xem tất cả thông báo →' }).click();
  await expect(page).toHaveURL(/\/participant\/notifications$/);
  await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible();
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`notification workspace remains readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockNotifications(page);
    await page.goto('/participant/notifications');
    const firstCard = page.locator('.participant-notification-card').first();
    await expect(firstCard).toBeInViewport();
    await expect(firstCard.getByRole('heading')).toBeVisible();
  });
}
