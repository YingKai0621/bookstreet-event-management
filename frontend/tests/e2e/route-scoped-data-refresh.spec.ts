import { expect, test, type Page, type Route } from '@playwright/test';

type Role = 'ORGANIZER' | 'ADMIN' | 'PARTNER' | 'PARTICIPANT';

const event = {
  eventId: 746,
  organizerUserId: 7,
  name: 'Sự kiện kiểm tra tải dữ liệu',
  description: 'Dữ liệu kiểm thử route-scoped loading.',
  startAt: '2027-01-11T02:00:00Z',
  endAt: '2027-01-12T02:00:00Z',
  status: 'PUBLISHED',
  bannerUrl: null,
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-20T00:00:00Z',
};

function pageResponse(content: unknown[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockRoleApi(page: Page, role: Role) {
  const counts = new Map<string, number>();

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const key = `${route.request().method()} ${path}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/auth/me')) {
      return json(route, {
        userId: 7,
        username: role.toLowerCase(),
        fullName: `${role} Test`,
        email: `${role.toLowerCase()}@example.test`,
        emailVerified: true,
        status: 'ACTIVE',
        roles: role === 'PARTICIPANT' ? ['PARTICIPANT'] : ['PARTICIPANT', role],
      });
    }
    if (path === '/api/v1/auth/profile') {
      return json(route, { id: 7, fullName: 'PARTICIPANT Test', email: 'participant@example.test', emailVerified: true, phone: null, avatarUrl: null });
    }
    if (path === '/api/v1/organizer/events') return json(route, pageResponse([event]));
    if (path === '/api/v1/organizer/activities') return json(route, pageResponse([]));
    if (path === '/api/v1/organizer/activity-proposals') return json(route, pageResponse([]));
    if (path === '/api/v1/organizer/activity-change-requests') return json(route, pageResponse([]));
    if (path === '/api/v1/organizer/activity-cancellation-requests') return json(route, pageResponse([]));
    if (path === '/api/v1/organizer/notifications') return json(route, pageResponse([]));
    if (path === '/api/v1/organizer/notifications/unread-count') return json(route, { unreadCount: 0 });
    if (path === '/api/v1/admin/notifications') return json(route, pageResponse([]));
    if (path === '/api/v1/admin/notifications/unread-count') return json(route, { unreadCount: 0 });
    if (path === '/api/v1/admin/users') return json(route, pageResponse([]));
    if (path === '/api/v1/partner/organization') {
      return json(route, {
        partnerOrganizationId: 9,
        name: 'Nhà sách Test',
        description: '',
        categoryCode: 'BOOKSTORE',
        logoUrl: null,
        contactEmail: 'partner@example.test',
        contactPhone: null,
        address: null,
        status: 'ACTIVE',
      });
    }
    if (path === '/api/v1/partner/applications') return json(route, pageResponse([]));
    if (path === '/api/v1/partner/booth-requests') return json(route, pageResponse([]));
    if (path === '/api/v1/partner/notifications') return json(route, pageResponse([]));
    if (path === '/api/v1/partner/notifications/unread-count') return json(route, { unreadCount: 0 });
    if (path === '/api/v1/events') return json(route, pageResponse([]));
    if (path === '/api/v1/participant/event-registrations') return json(route, pageResponse([]));
    if (path === '/api/v1/participant/activity-registrations') return json(route, pageResponse([]));
    if (path === '/api/v1/participant/notifications') return json(route, pageResponse([]));
    if (path === '/api/v1/participant/notifications/unread-count') return json(route, { unreadCount: 0 });
    return json(route, []);
  });

  return {
    counts,
    total: () => [...counts.values()].reduce((sum, value) => sum + value, 0),
    count: (path: string) => counts.get(`GET ${path}`) ?? 0,
  };
}

async function expectIdleNetwork(page: Page, total: () => number): Promise<void> {
  await page.waitForLoadState('networkidle');
  const settledRequestCount = total();
  await page.clock.fastForward(31_000);
  await page.waitForTimeout(100);
  expect(total()).toBe(settledRequestCount);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test('Organizer loads only its active workspace and stays idle without polling', async ({ page }) => {
  const requests = await mockRoleApi(page, 'ORGANIZER');
  await page.goto('/organizer/activities?eventId=746');

  await expect(page.getByRole('heading', { name: 'Quản lý hoạt động' })).toBeVisible();
  expect(requests.count('/api/v1/events')).toBe(0);
  expect(requests.count('/api/v1/auth/profile')).toBe(0);
  expect(requests.count('/api/v1/organizer/profile')).toBe(0);
  expect(requests.count('/api/v1/organizer/notifications')).toBe(1);
  expect(requests.count('/api/v1/organizer/notifications/unread-count')).toBe(1);
  expect(requests.count('/api/v1/participant/event-registrations')).toBe(0);
  expect(requests.count('/api/v1/participant/activity-registrations')).toBe(0);
  expect(requests.count('/api/v1/organizer/events')).toBe(1);
  expect(requests.count('/api/v1/organizer/activities')).toBe(1);
  await expectIdleNetwork(page, requests.total);
});

test('Organizer profile uses the shared auth contract without loading unsupported APIs', async ({ page }) => {
  const requests = await mockRoleApi(page, 'ORGANIZER');
  await page.goto('/organizer/profile');

  await expect(page.getByRole('heading', { name: 'Hồ sơ Ban Quản Lý' })).toBeVisible();
  expect(requests.count('/api/v1/auth/profile')).toBe(1);
  expect(requests.count('/api/v1/organizer/profile')).toBe(0);
  expect(requests.count('/api/v1/organizer/notifications')).toBe(1);
  expect(requests.count('/api/v1/organizer/notifications/unread-count')).toBe(1);
  expect(requests.count('/api/v1/organizer/reports')).toBe(0);
  expect(requests.count('/api/v1/organizer/feedbacks')).toBe(0);
  await expectIdleNetwork(page, requests.total);
});

test('Admin user management does not preload unrelated tabs or poll in the background', async ({ page }) => {
  const requests = await mockRoleApi(page, 'ADMIN');
  await page.goto('/admin/users');

  await expect(page.getByRole('heading', { name: 'Quản lý Tài khoản' })).toBeVisible();
  expect(requests.count('/api/v1/admin/dashboard')).toBe(0);
  expect(requests.count('/api/v1/admin/audit-logs')).toBe(0);
  expect(requests.count('/api/v1/admin/roles')).toBe(0);
  expect(requests.count('/api/v1/events')).toBe(0);
  expect(requests.count('/api/v1/participant/event-registrations')).toBe(0);
  expect(requests.count('/api/v1/admin/profile')).toBe(0);
  expect(requests.count('/api/v1/auth/profile')).toBe(1);
  expect(requests.count('/api/v1/admin/notifications')).toBe(1);
  expect(requests.count('/api/v1/admin/notifications/unread-count')).toBe(1);
  expect(requests.count('/api/v1/admin/users')).toBe(1);
  await expectIdleNetwork(page, requests.total);
});

test('Participant workspace loads published events and stays idle', async ({ page }) => {
  const requests = await mockRoleApi(page, 'PARTICIPANT');
  await page.goto('/participant');

  await expect(page.getByRole('heading', { name: 'Xin chào, PARTICIPANT Test!' })).toBeVisible();
  expect(requests.count('/api/v1/events')).toBe(1);
  expect(requests.count('/api/v1/heritages')).toBe(0);
  expect(requests.count('/api/v1/events/746/booths')).toBe(0);
  expect(requests.count('/api/v1/auth/profile')).toBe(1);
  expect(requests.count('/api/v1/participant/event-registrations')).toBe(1);
  expect(requests.count('/api/v1/participant/activity-registrations')).toBe(1);
  await expectIdleNetwork(page, requests.total);
});

test('Partner workspace does not load Participant data or poll while idle', async ({ page }) => {
  const requests = await mockRoleApi(page, 'PARTNER');
  await page.goto('/partner');

  await expect(page.getByRole('heading', { name: 'Xin chào, Nhà sách Test!' })).toBeVisible();
  expect(requests.count('/api/v1/participant/event-registrations')).toBe(0);
  expect(requests.count('/api/v1/participant/activity-registrations')).toBe(0);
  expect(requests.count('/api/v1/events/746/booths')).toBe(0);
  expect(requests.count('/api/v1/partner/organization')).toBe(1);
  expect(requests.count('/api/v1/partner/applications')).toBe(1);
  expect(requests.count('/api/v1/partner/booth-requests')).toBe(1);
  expect(requests.count('/api/v1/partner/notifications')).toBe(1);
  expect(requests.count('/api/v1/partner/notifications/unread-count')).toBe(1);
  expect(requests.count('/api/v1/partner/reports')).toBe(0);
  await expectIdleNetwork(page, requests.total);
});
