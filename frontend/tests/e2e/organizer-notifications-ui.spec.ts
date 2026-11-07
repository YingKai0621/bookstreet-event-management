import { expect, Page, Route, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || '';

const notifications = [
  {
    notificationId: 71,
    type: 'ORGANIZER_NEW_PARTNER_APPLICATION',
    title: 'Có hồ sơ đối tác mới',
    message: 'Một đối tác vừa gửi hồ sơ tham gia sự kiện và đang chờ bạn xem xét.',
    referenceType: 'PARTNER_APPLICATION',
    referenceId: 701,
    contextEventId: 501,
    createdAt: '2026-11-05T08:30:00Z',
    readAt: null,
    read: false,
  },
  {
    notificationId: 72,
    type: 'ORGANIZER_NEW_BOOTH_REQUEST',
    title: 'Có yêu cầu gian hàng mới',
    message: 'Một đối tác vừa gửi yêu cầu gian hàng và đang chờ bạn xem xét.',
    referenceType: 'BOOTH_REQUEST',
    referenceId: 702,
    contextEventId: 501,
    createdAt: '2026-11-04T08:30:00Z',
    readAt: '2026-11-04T09:00:00Z',
    read: true,
  },
];

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, options: { failListOnce?: boolean; listStatus?: number; rows?: typeof notifications } = {}) {
  let listFailuresLeft = options.failListOnce ? 1 : 0;
  let listCalls = 0;
  let unreadCount = 1;
  let currentRows = (options.rows ?? notifications).map(item => ({ ...item }));
  const calls = { markOne: 0, markAll: 0 };

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path.endsWith('/auth/me')) return json(route, {
      userId: 1, username: 'organizer', fullName: 'Organizer', email: 'organizer@example.com',
      emailVerified: true, status: 'ACTIVE', roles: ['ORGANIZER'],
    });
    if (path.endsWith('/organizer/notifications/unread-count')) return json(route, { unreadCount });
    if (path.endsWith('/organizer/notifications/read-all')) {
      calls.markAll += 1;
      currentRows = currentRows.map(item => ({ ...item, read: true, readAt: item.readAt || '2026-11-05T09:00:00Z' }));
      unreadCount = 0;
      return json(route, { updatedCount: 1 });
    }
    const markOne = path.match(/\/organizer\/notifications\/(\d+)\/read$/);
    if (markOne && route.request().method() === 'POST') {
      calls.markOne += 1;
      const id = Number(markOne[1]);
      currentRows = currentRows.map(item => item.notificationId === id
        ? { ...item, read: true, readAt: '2026-11-05T09:00:00Z' } : item);
      unreadCount = 0;
      return json(route, currentRows.find(item => item.notificationId === id));
    }
    if (path.endsWith('/organizer/notifications')) {
      listCalls += 1;
      if (options.listStatus) return json(route, { code: 'DENIED' }, options.listStatus);
      if (listFailuresLeft > 0) {
        listFailuresLeft -= 1;
        return json(route, { code: 'UNAVAILABLE' }, 503);
      }
      let rows = currentRows;
      const read = url.searchParams.get('read');
      if (read !== null) rows = rows.filter(item => item.read === (read === 'true'));
      const type = url.searchParams.get('type');
      if (type) rows = rows.filter(item => item.type === type);
      const page = Number(url.searchParams.get('page') || 0);
      const size = Number(url.searchParams.get('size') || 20);
      const content = rows.slice(page * size, (page + 1) * size);
      return json(route, {
        content, page, size, totalElements: rows.length,
        totalPages: rows.length ? Math.ceil(rows.length / size) : 0,
      });
    }
    if (path.endsWith('/organizer/events')) return json(route, {
      content: [{ eventId: 501, organizerUserId: 1, name: 'Hội sách Mùa Xuân', status: 'PUBLISHED', startAt: '2027-05-01T00:00:00Z', endAt: '2027-05-02T00:00:00Z' }],
      page: 0, size: 100, totalElements: 1, totalPages: 1,
    });
    if (path.endsWith('/organizer/dashboard')) return json(route, {
      activeEventCount: 1, pendingPartnerApplicationCount: 1, pendingBoothRequestCount: 1,
      eventStatusCounts: { DRAFT: 0, PUBLISHED: 1, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 },
      partnerApplicationStatusCounts: { PENDING: 1, APPROVED: 0, REJECTED: 0, WITHDRAWN: 0 }, priorityTasks: [],
    });
    return json(route, {});
  });

  return { calls, getListCalls: () => listCalls };
}

test.describe('Organizer notifications inbox', () => {
  test('shows preview and unread badge, filters, marks one read, and navigates to an allowlisted target', async ({ page }) => {
    const state = await setup(page);
    await page.goto(`${BASE_URL}/organizer/notifications`);

    await expect(page.getByRole('heading', { name: 'Thông báo' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Có hồ sơ đối tác mới/ })).toBeVisible();
    await expect(page.getByText('Có yêu cầu gian hàng mới')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thông báo 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xem thông báo \(1 chưa đọc\)/ })).toBeVisible();

    await page.getByRole('button', { name: /Xem thông báo/ }).click();
    await expect(page.getByText('Thông báo gần đây')).toBeVisible();
    await expect(page.locator('.organizer-topbar').getByText('Có hồ sơ đối tác mới')).toBeVisible();
    await page.getByRole('button', { name: 'Xem tất cả thông báo' }).click();

    await page.getByRole('tab', { name: /Chưa đọc/ }).click();    await expect(page.getByText('Có hồ sơ đối tác mới')).toBeVisible();
    await expect(page.getByText('Có yêu cầu gian hàng mới')).toHaveCount(0);

    await page.getByRole('button', { name: /Có hồ sơ đối tác mới/ }).click();
    await expect(page).toHaveURL(/\/organizer\/events\/501\?section=partners$/);
    expect(state.calls.markOne).toBe(1);
  });

  for (const [type, referenceType, target] of [
    ['ORGANIZER_BOOTH_PAYMENT_CONFIRMED', 'BOOTH_REQUEST', '/organizer/booth-requests?eventId=501'],
    ['ORGANIZER_BOOTH_RESELECTION_REQUIRED', 'BOOTH_REQUEST', '/organizer/booth-requests?eventId=501'],
    ['ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED', 'ACTIVITY_PROPOSAL', '/organizer/activities?eventId=501&view=proposals'],
    ['ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST', 'ACTIVITY_REQUEST', '/organizer/activities?eventId=501&view=changes'],
    ['ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST', 'ACTIVITY_REQUEST', '/organizer/activities?eventId=501&view=cancellations'],
  ]) {
    test(`${type} opens its owner-scoped queue after the read is confirmed`, async ({ page }) => {
      const state = await setup(page, { rows: [{ ...notifications[0], type, referenceType, title: 'Việc cần xử lý' }] });
      await page.goto(`${BASE_URL}/organizer/notifications`);

      await page.getByRole('button', { name: /Việc cần xử lý/ }).click();

      await expect.poll(() => { const url = new URL(page.url()); return url.pathname + url.search; }).toBe(target);
      expect(state.calls.markOne).toBe(1);
    });
  }

  test('shows a retryable API error and retries instead of showing an empty inbox', async ({ page }) => {
    const state = await setup(page, { failListOnce: true });
    await page.goto(`${BASE_URL}/organizer/notifications`);

    await expect(page.getByRole('alert')).toContainText('Không tải được thông báo');
    await expect(page.getByText('Bạn chưa có thông báo nào')).toHaveCount(0);
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByText('Có hồ sơ đối tác mới')).toBeVisible();
    expect(state.getListCalls()).toBeGreaterThan(1);
  });

  test('shows a forbidden response instead of an empty inbox', async ({ page }) => {
    await setup(page, { listStatus: 403 });
    await page.goto(`${BASE_URL}/organizer/notifications`);

    await expect(page.getByRole('alert').filter({ hasText: 'Bạn không có quyền xem thông báo Organizer.' }).first()).toBeVisible();
    await expect(page.getByText('Bạn chưa có thông báo nào')).toHaveCount(0);
  });

  test('shows sign-in instead of an empty inbox when the session expires', async ({ page }) => {
    await setup(page, { listStatus: 401 });
    await page.goto(`${BASE_URL}/organizer/notifications`);

    await expect(page.getByRole('button', { name: 'Đăng nhập vào Cổng Quản Lý' })).toBeVisible();
    await expect(page.getByText('Bạn chưa có thông báo nào')).toHaveCount(0);
  });

  test('marks all read through the server and refreshes the unread count', async ({ page }) => {
    const state = await setup(page);
    await page.goto(`${BASE_URL}/organizer/notifications`);
    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click();

    await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toBeVisible();
    expect(state.calls.markAll).toBe(1);
  });
});
