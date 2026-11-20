import { expect, test, type Page, type Route } from '@playwright/test';

// AC-OPT-S11-01: Admin reads Booth Payments across Events and cannot change them.

function payment(id: number, overrides: Record<string, unknown> = {}) {
  return {
    boothPaymentId: id,
    event: { eventId: 501, name: 'Hội sách mùa thu' },
    partnerOrganization: { partnerOrganizationId: 9, name: 'Nhà sách Mộc Miên' },
    booth: { boothId: 31, code: 'A01', name: 'Gian A01' },
    transactionType: 'PAYMENT',
    amount: 1500000,
    status: 'SUCCESS',
    reconciliationRequired: false,
    gatewayProvider: 'VNPAY',
    gatewayTransactionRef: `BS${id}`,
    failureCode: null,
    createdAt: '2026-11-08T03:00:00Z',
    completedAt: '2026-11-08T03:05:00Z',
    ...overrides,
  };
}

const ROWS = [
  payment(3, { status: 'PENDING', reconciliationRequired: true, completedAt: null, amount: 2000000,
    event: { eventId: 777, name: 'Đêm thơ đường sách' } }),
  payment(2, { status: 'FAILED', failureCode: 'GATEWAY_DECLINED' }),
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
    if (path === '/auth/csrf') return json(route, { headerName: 'X-XSRF-TOKEN', token: 'test' });
    if (path === '/auth/me') {
      return json(route, { userId: 1, username: 'admin', fullName: 'Quản trị viên', email: 'admin@example.test',
        emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ADMIN'] });
    }
    if (path === '/auth/profile') {
      return json(route, { id: 1, fullName: 'Quản trị viên', email: 'admin@example.test', phone: null, avatarUrl: null, emailVerified: true });
    }
    if (path.endsWith('/unread-count')) return json(route, { unreadCount: 0 });
    if (path.startsWith('/admin/booth-payments')) {
      if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`);
      queries.push(url.searchParams);
      if (options.failStatus) return json(route, { code: 'DENIED', message: 'Denied' }, options.failStatus);
      const status = url.searchParams.get('status');
      const eventId = url.searchParams.get('eventId');
      const reconciliation = url.searchParams.get('reconciliationRequired');
      const content = ROWS.filter(row => (!status || row.status === status)
        && (!eventId || String(row.event.eventId) === eventId)
        && (!reconciliation || String(row.reconciliationRequired) === reconciliation));
      return json(route, { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0 });
    }
    return json(route, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });
  return { queries, mutations };
}

test('the payment history lists every status across Events and offers no change action', async ({ page }) => {
  const { mutations } = await setup(page);
  await page.goto('/admin/payments');

  await expect(page.getByRole('heading', { name: 'Lịch sử thanh toán' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lịch sử thanh toán', exact: true })).toHaveAttribute('aria-current', 'page');
  const rows = page.locator('.adm-payments-table tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Đang chờ');
  await expect(rows.nth(0)).toContainText('Cần đối soát');
  await expect(rows.nth(0)).toContainText('Đêm thơ đường sách');
  await expect(rows.nth(1)).toContainText('Thất bại');
  await expect(rows.nth(2)).toContainText('Thành công');
  await expect(rows.nth(2)).toContainText('1.500.000');

  const main = page.locator('.admin-main-viewport');
  for (const action of ['Hoàn tiền', 'Hủy', 'Xóa', 'Sửa', 'Duyệt']) {
    await expect(main.getByRole('button', { name: action, exact: true })).toHaveCount(0);
  }
  expect(mutations).toEqual([]);
});

test('all seven payment columns fit without horizontal scrolling', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/payments');
  await expect(page.locator('.adm-payments-table tbody tr')).toHaveCount(3);

  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const wrapper = page.locator('.adm-payments-view .adm-table-responsive');
    await expect.poll(() => wrapper.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const lastCell = page.locator('.adm-payments-table tbody tr').first().locator('td').last();
    const bounds = await wrapper.boundingBox();
    const actionBounds = await lastCell.boundingBox();
    expect(bounds).not.toBeNull();
    expect(actionBounds).not.toBeNull();
    expect(actionBounds!.x + actionBounds!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  }
});

test('filters reach the server and an Event name narrows the list to that Event', async ({ page }) => {
  const { queries } = await setup(page);
  await page.goto('/admin/payments');
  const rows = page.locator('.adm-payments-table tbody tr');
  await expect(rows).toHaveCount(3);

  await page.getByRole('combobox', { name: 'Lọc theo trạng thái thanh toán' }).selectOption('FAILED');
  await expect(rows).toHaveCount(1);
  expect(queries.at(-1)?.get('status')).toBe('FAILED');
  await page.getByRole('combobox', { name: 'Lọc theo trạng thái thanh toán' }).selectOption('');

  await page.getByLabel('Chỉ giao dịch cần đối soát').check();
  await expect(rows).toHaveCount(1);
  expect(queries.at(-1)?.get('reconciliationRequired')).toBe('true');
  await page.getByLabel('Chỉ giao dịch cần đối soát').uncheck();
  await expect(rows).toHaveCount(3);

  await page.getByRole('button', { name: 'Đêm thơ đường sách' }).click();
  await expect(page.getByText('Đang xem sự kiện:')).toContainText('Đêm thơ đường sách');
  await expect(rows).toHaveCount(1);
  expect(queries.at(-1)?.get('eventId')).toBe('777');
  await page.getByRole('button', { name: 'Bỏ lọc theo sự kiện' }).click();
  await expect(rows).toHaveCount(3);

  await page.getByRole('combobox', { name: 'Sắp xếp giao dịch' }).selectOption('amount,desc');
  await expect.poll(() => queries.at(-1)?.get('sort')).toBe('amount,desc');
});

test('an impossible date range is explained before any request is sent', async ({ page }) => {
  const { queries } = await setup(page);
  await page.goto('/admin/payments');
  await expect(page.locator('.adm-payments-table tbody tr')).toHaveCount(3);
  const before = queries.length;

  await page.getByLabel('Lọc từ ngày').fill('2026-11-09');
  await page.getByLabel('Lọc đến ngày').fill('2026-11-01');
  await expect(page.getByRole('alert')).toContainText('"Từ ngày" phải trước hoặc trùng "Đến ngày".');
  await expect(page.getByLabel('Lọc từ ngày')).toHaveAttribute('aria-invalid', 'true');
  const afterInvalid = queries.length;
  expect(afterInvalid - before).toBeLessThanOrEqual(1);

  await page.getByLabel('Lọc đến ngày').fill('2026-11-10');
  await expect(page.locator('.day-first-date-label').filter({ hasText: '09/11/2026' })).toBeVisible();
  await expect(page.locator('.day-first-date-label').filter({ hasText: '10/11/2026' })).toBeVisible();
  await expect(page.locator('.adm-payments-table tbody tr')).toHaveCount(3);
  expect(queries.at(-1)?.get('from')).toBe('2026-11-09');
  expect(queries.at(-1)?.get('to')).toBe('2026-11-10');
});

test('the detail dialog shows the transaction without gateway secrets', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/payments');

  await page.getByRole('button', { name: 'Xem chi tiết giao dịch 3' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Giao dịch #3');
  await expect(dialog).toContainText('cần đối soát');
  await expect(dialog).toContainText('Chưa kết thúc');
  await expect(dialog).toContainText('BS3');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Xem chi tiết giao dịch 2' }).click();
  await expect(page.getByRole('dialog')).toContainText('GATEWAY_DECLINED');
});

test('a failed load is shown as an error, never as an empty history', async ({ page }) => {
  await setup(page, { failStatus: 503 });
  await page.goto('/admin/payments');

  await expect(page.getByRole('alert')).toContainText('Không tải được lịch sử thanh toán');
  await expect(page.getByText('Chưa có giao dịch thanh toán nào.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
});

test('a forbidden response explains the missing permission', async ({ page }) => {
  await setup(page, { failStatus: 403 });
  await page.goto('/admin/payments');
  await expect(page.getByRole('alert')).toContainText('Bạn không có quyền xem lịch sử thanh toán.');
});
