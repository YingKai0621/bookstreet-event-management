import { expect, test, type Page, type Route } from '@playwright/test';

const auditRow = {
  auditLogId: 501,
  actor: { userId: 1, username: 'admin', fullName: 'Quản trị viên' },
  action: 'USER_LOCKED',
  targetType: 'USER',
  targetId: 12,
  targetLabel: 'mocmien01',
  reason: 'Tài khoản có dấu hiệu bị lạm dụng.',
  details: { from: 'ACTIVE', to: 'DISABLED' },
  createdAt: '2026-11-07T01:00:00Z',
};

function page(content: unknown[]) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(target: Page, options: { failuresBeforeSuccess?: number; status?: number; rows?: unknown[] } = {}) {
  let failuresLeft = options.failuresBeforeSuccess ?? 0;
  const auditQueries: URLSearchParams[] = [];
  const paths: string[] = [];
  await target.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    paths.push(url.pathname);
    if (url.pathname.endsWith('/auth/csrf')) return json(route, { headerName: 'X-XSRF-TOKEN', token: 'test' });
    if (url.pathname.endsWith('/auth/me')) {
      return json(route, {
        userId: 1, username: 'admin', fullName: 'Quản trị viên', email: 'admin@example.test',
        emailVerified: true, status: 'ACTIVE', roles: ['ADMIN'],
      });
    }
    if (url.pathname.endsWith('/admin/profile')) return json(route, { id: 1, fullName: 'Quản trị viên', email: 'admin@example.test' });
    if (url.pathname.endsWith('/admin/notifications/unread-count')) return json(route, { unreadCount: 0 });
    if (url.pathname.endsWith('/admin/notifications')) return json(route, page([]));
    if (url.pathname.endsWith('/admin/dashboard')) {
      return json(route, dashboard());
    }
    if (url.pathname.endsWith('/admin/users')) return json(route, page([]));
    if (url.pathname.endsWith('/admin/audit-logs')) {
      auditQueries.push(url.searchParams);
      if (options.status) return json(route, { code: 'DENIED', message: 'Denied' }, options.status);
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        return json(route, { code: 'UNAVAILABLE', message: 'Failed' }, 503);
      }
      const rows = options.rows ?? [auditRow];
      const filtered = url.searchParams.get('action') && url.searchParams.get('action') !== 'USER_LOCKED' ? [] : rows;
      return json(route, page(filtered));
    }
    return json(route, page([]));
  });
  return { auditQueries, paths };
}

function dashboard() {
  return { accounts: { total: 0, byRole: { PARTICIPANT: 0, PARTNER: 0, ORGANIZER: 0, ADMIN: 0 }, byStatus: { ACTIVE: 0, DISABLED: 0 } }, events: { total: 0, byStatus: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 } }, activeBoothAssignments: 0, boothRevenue: 0, auditByDay: Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-0${index + 1}`, count: 0 })) };
}

test('the audit screen shows real rows with a readable action, reason and detail', async ({ page: browser }) => {
  await setup(browser);
  await browser.goto('/admin/audit');

  await expect(browser.getByRole('heading', { name: 'Nhật ký hệ thống' })).toBeVisible();
  const row = browser.locator('tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Khóa tài khoản');
  await expect(row).toContainText('mocmien01');
  await expect(row).toContainText('Tài khoản có dấu hiệu bị lạm dụng.');
  await expect(row).toContainText('Hoạt động → Đã khóa');

  await browser.getByRole('button', { name: 'Xem chi tiết nhật ký 501' }).click();
  await expect(browser.getByRole('dialog')).toContainText('Tài khoản: mocmien01 (mã 12)');
  await browser.keyboard.press('Escape');
  await expect(browser.getByRole('dialog')).toHaveCount(0);
});

test('filters are sent to the server and reset to the first page', async ({ page: browser }) => {
  const { auditQueries } = await setup(browser);
  await browser.goto('/admin/audit');
  await expect(browser.locator('tbody tr')).toHaveCount(1);

  await browser.getByLabel('Lọc theo loại đối tượng').selectOption('USER');
  await browser.getByLabel('Lọc theo mã đối tượng').fill('12');
  await browser.getByLabel('Lọc theo mã người thực hiện').fill('1');
  await browser.getByLabel('Lọc từ ngày').fill('2026-11-01');
  await browser.getByLabel('Lọc đến ngày').fill('2026-11-07');
  await expect(browser.locator('.day-first-date-label').filter({ hasText: '01/11/2026' })).toBeVisible();
  await expect(browser.locator('.day-first-date-label').filter({ hasText: '07/11/2026' })).toBeVisible();

  await expect.poll(() => {
    const last = auditQueries.at(-1)!;
    return [last.get('targetType'), last.get('targetId'), last.get('actorUserId'), last.get('from'), last.get('to'), last.get('page')].join('|');
  }).toBe('USER|12|1|2026-11-01|2026-11-07|0');
});

test('a filter with no match differs from an empty audit log', async ({ page: browser }) => {
  await setup(browser);
  await browser.goto('/admin/audit');

  await browser.getByLabel('Lọc theo hành động').selectOption('BADGE_CREATED');
  await expect(browser.getByText('Không có bản ghi nào khớp với bộ lọc.')).toBeVisible();
  await browser.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(browser.locator('tbody tr')).toHaveCount(1);
});

test('an empty audit log says so', async ({ page: browser }) => {
  await setup(browser, { rows: [] });
  await browser.goto('/admin/audit');

  await expect(browser.getByText('Chưa có thao tác quản trị nào được ghi lại.')).toBeVisible();
});

test('a failure is not shown as an empty log and can be retried', async ({ page: browser }) => {
  await setup(browser, { failuresBeforeSuccess: 1 });
  await browser.goto('/admin/audit');

  await expect(browser.getByRole('alert')).toContainText('Không tải được nhật ký hệ thống');
  await expect(browser.getByText('Chưa có thao tác quản trị nào được ghi lại.')).toHaveCount(0);
  await browser.getByRole('button', { name: 'Thử lại' }).click();
  await expect(browser.locator('tbody tr')).toHaveCount(1);
});

test('a 403 response is shown as itself', async ({ page: browser }) => {
  await setup(browser, { status: 403 });
  await browser.goto('/admin/audit');

  await expect(browser.getByRole('alert')).toContainText('Bạn không có quyền xem nhật ký hệ thống.');
});

test('an expired session returns to sign-in instead of an empty log', async ({ page: browser }) => {
  await setup(browser, { status: 401 });
  await browser.goto('/admin/audit');

  await expect(browser.getByText('Chưa có thao tác quản trị nào được ghi lại.')).toHaveCount(0);
  await expect(browser.locator('.adm-table tbody tr')).toHaveCount(0);
  await expect(browser.getByRole('button', { name: /Đăng nhập/ }).first()).toBeVisible();
});

test('the dashboard keeps its figures when recent activity fails', async ({ page: browser }) => {
  await setup(browser, { status: 503 });
  await browser.goto('/admin');

  await expect(browser.getByRole('alert')).toContainText('Không tải được hoạt động gần đây.');
  await expect(browser.getByText('Chưa có thao tác quản trị nào phát sinh')).toHaveCount(0);
  await expect(browser.locator('.adm-kpi-value').first()).toBeVisible();
});

test('the Admin workspace offers only approved screens and calls no removed API', async ({ page: browser }) => {
  const { paths } = await setup(browser);
  await browser.goto('/admin');
  await expect(browser.getByRole('button', { name: 'Tổng quan', exact: true })).toBeVisible();

  for (const removed of ['Danh mục gian hàng', 'Địa điểm tổ chức', 'Thiết bị', 'Cài đặt hệ thống', 'Vai trò & Phân quyền']) {
    await expect(browser.getByRole('button', { name: removed, exact: true })).toHaveCount(0);
  }
  await expect(browser.getByRole('button', { name: 'Tổ chức đối tác', exact: true })).toBeVisible();
  for (const tab of ['Vai trò', 'Nhật ký hệ thống', 'Tổ chức đối tác', 'Quản lý người dùng']) {
    await browser.getByRole('button', { name: tab, exact: true }).click();
    await expect(browser.locator('.workspace-page-title').first()).toBeVisible();
  }
  for (const removedApi of ['/admin/roles', '/admin/permissions', '/admin/settings', '/admin/badge-rules', '/admin/feedbacks/stats', '/organizer/']) {
    expect(paths.filter(path => path.includes(removedApi))).toEqual([]);
  }
});
