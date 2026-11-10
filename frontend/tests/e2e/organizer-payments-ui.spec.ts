import { expect, test, type Page, type Route } from '@playwright/test';

// AC-ORG-PAY-S11-01 and 02: an Organizer reads the Booth Payments of their own Events.

function payment(id: number, overrides: Record<string, unknown> = {}) {
  return {
    boothPaymentId: id,
    event: { eventId: 501, name: 'Hội sách Mùa Xuân' },
    partnerOrganization: { partnerOrganizationId: 9, name: 'Nhà sách Mộc Miên' },
    booth: { boothId: 31, code: 'A01', name: 'Gian A01' },
    transactionType: 'PAYMENT',
    amount: 1500000,
    status: 'SUCCESS',
    createdAt: '2026-11-08T03:00:00Z',
    completedAt: '2026-11-08T03:05:00Z',
    ...overrides,
  };
}

const ROWS = [
  payment(3, { status: 'PENDING', completedAt: null, amount: 900000 }),
  payment(2, { status: 'FAILED', event: { eventId: 502, name: 'Đêm thơ' } }),
  payment(1),
];

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, options: { failStatus?: number } = {}) {
  const queries: URLSearchParams[] = [];
  const mutations: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/csrf') return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path === '/auth/me') {
      return json(route, { userId: 1, username: 'organizer', fullName: 'Organizer', email: 'organizer@example.com',
        emailVerified: true, status: 'ACTIVE', roles: ['ORGANIZER'] });
    }
    if (path.endsWith('/unread-count')) return json(route, { unreadCount: 0 });
    if (path === '/organizer/events') {
      return json(route, {
        content: [
          { eventId: 501, organizerUserId: 1, name: 'Hội sách Mùa Xuân', status: 'PUBLISHED', startAt: '2027-05-01T00:00:00Z', endAt: '2027-05-02T00:00:00Z' },
          { eventId: 502, organizerUserId: 1, name: 'Đêm thơ', status: 'PUBLISHED', startAt: '2027-06-01T00:00:00Z', endAt: '2027-06-02T00:00:00Z' },
        ],
        page: 0, size: 100, totalElements: 2, totalPages: 1,
      });
    }
    if (path.startsWith('/organizer/booth-payments')) {
      if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`);
      queries.push(url.searchParams);
      if (options.failStatus) return json(route, { code: 'DENIED', message: 'Denied' }, options.failStatus);
      const status = url.searchParams.get('status');
      const eventId = url.searchParams.get('eventId');
      const byEvent = ROWS.filter(row => !eventId || String(row.event.eventId) === eventId);
      const content = byEvent.filter(row => !status || row.status === status);
      // The collected total ignores the status filter, as the API does.
      const collectedAmount = byEvent.filter(row => row.status === 'SUCCESS')
        .reduce((sum, row) => sum + Number(row.amount), 0);
      return json(route, { content, page: 0, size: 20, totalElements: content.length,
        totalPages: content.length ? 1 : 0, collectedAmount });
    }
    return json(route, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });
  return { queries, mutations };
}

test('the Organizer sees payments of their Events with the money collected', async ({ page }) => {
  const { mutations } = await setup(page);
  await page.goto('/organizer/payments');

  await expect(page.getByRole('heading', { name: 'Lịch sử thanh toán' })).toBeVisible();
  const rows = page.locator('.organizer-payments-table tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Đang chờ');
  await expect(rows.nth(1)).toContainText('Thất bại');
  await expect(rows.nth(2)).toContainText('Thành công');
  await expect(page.locator('.organizer-payments-total')).toContainText('1.500.000');
  await expect(page.locator('.organizer-payments-total')).toContainText('tất cả sự kiện');

  // Gateway details belong to Admin oversight.
  await expect(page.getByText('Cần đối soát')).toHaveCount(0);
  for (const action of ['Hoàn tiền', 'Hủy', 'Xóa', 'Duyệt']) {
    await expect(page.locator('.organizer-payments-page').getByRole('button', { name: action, exact: true })).toHaveCount(0);
  }
  expect(mutations).toEqual([]);
});

test('choosing an Event narrows the list and the collected total to that Event', async ({ page }) => {
  const { queries } = await setup(page);
  await page.goto('/organizer/payments');
  const rows = page.locator('.organizer-payments-table tbody tr');
  await expect(rows).toHaveCount(3);

  await page.getByRole('combobox', { name: 'Lọc theo sự kiện' }).selectOption('502');
  await expect(rows).toHaveCount(1);
  expect(queries.at(-1)?.get('eventId')).toBe('502');
  await expect(page.locator('.organizer-payments-total')).toContainText('Đêm thơ');
  await expect(page.locator('.organizer-payments-total')).toContainText('0');

  await page.getByRole('combobox', { name: 'Lọc theo sự kiện' }).selectOption('501');
  await page.getByRole('combobox', { name: 'Lọc theo trạng thái thanh toán' }).selectOption('PENDING');
  await expect(rows).toHaveCount(1);
  // Looking at pending attempts does not change what has been collected.
  await expect(page.locator('.organizer-payments-total')).toContainText('1.500.000');
});

test('an impossible date range is explained instead of being sent', async ({ page }) => {
  const { queries } = await setup(page);
  await page.goto('/organizer/payments');
  await expect(page.locator('.organizer-payments-table tbody tr')).toHaveCount(3);

  await page.getByLabel('Lọc từ ngày').fill('2026-11-09');
  await page.getByLabel('Lọc đến ngày').fill('2026-11-01');
  await expect(page.getByRole('alert')).toContainText('"Từ ngày" phải trước hoặc trùng "Đến ngày".');
  expect(queries.some(query => query.get('from') === '2026-11-09' && query.get('to') === '2026-11-01')).toBe(false);
});

test('a failed load shows an error and never a zero total', async ({ page }) => {
  await setup(page, { failStatus: 503 });
  await page.goto('/organizer/payments');

  await expect(page.getByRole('alert')).toContainText('Không tải được lịch sử thanh toán');
  await expect(page.locator('.organizer-payments-total strong')).toHaveText('—');
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
});
