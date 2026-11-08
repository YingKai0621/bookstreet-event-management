import { expect, test, type Page, type Route } from '@playwright/test';

// Sprint 11 Developer B screens: AC-A01-S11-08, AC-A02-S11-06 and AC-ADM-S11-03.

type Account = {
  userId: number; username: string; fullName: string; email: string | null; emailVerified: boolean;
  phone: string | null; roles: string[]; status: 'ACTIVE' | 'DISABLED'; createdAt: string;
};

const ADMIN_ID = 1;

function accounts(): Account[] {
  return [
    { userId: ADMIN_ID, username: 'admin', fullName: 'Quản trị viên', email: 'admin@example.test', emailVerified: true,
      phone: null, roles: ['PARTICIPANT', 'ADMIN'], status: 'ACTIVE', createdAt: '2026-11-01T01:00:00Z' },
    { userId: 12, username: 'mocmien01', fullName: 'Nguyễn Văn A', email: 'a@example.test', emailVerified: true,
      phone: '0900000000', roles: ['PARTICIPANT', 'PARTNER', 'ORGANIZER'], status: 'ACTIVE', createdAt: '2026-11-02T01:00:00Z' },
    { userId: 13, username: 'khoa01', fullName: 'Trần Thị B', email: 'b@example.test', emailVerified: true,
      phone: null, roles: ['PARTICIPANT'], status: 'DISABLED', createdAt: '2026-11-03T01:00:00Z' },
    { userId: 14, username: 'chuaxacminh', fullName: 'Lê Văn C', email: 'c@example.test', emailVerified: false,
      phone: null, roles: ['PARTICIPANT'], status: 'ACTIVE', createdAt: '2026-11-04T01:00:00Z' },
  ];
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

interface Call { method: string; path: string; body: unknown }

async function setup(page: Page, failures: Record<string, { status: number; code: string }> = {}) {
  const data = accounts();
  const calls: Call[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData() as string) : null;
    calls.push({ method, path, body });

    const failure = failures[`${method} ${path}`];
    if (failure) return json(route, { code: failure.code, message: 'rejected', fieldErrors: [] }, failure.status);

    if (path === '/auth/csrf') return json(route, { headerName: 'X-XSRF-TOKEN', token: 'test' });
    if (path === '/auth/me') {
      return json(route, { userId: ADMIN_ID, username: 'admin', fullName: 'Quản trị viên', email: 'admin@example.test',
        emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ADMIN'] });
    }
    if (path === '/auth/profile' && method === 'GET') {
      return json(route, { id: ADMIN_ID, fullName: 'Quản trị viên', email: 'admin@example.test', phone: null, avatarUrl: null, emailVerified: true });
    }
    if (path === '/auth/profile' && method === 'PUT') {
      return json(route, { id: ADMIN_ID, ...(body as object), email: 'admin@example.test', emailVerified: true });
    }
    if (path.endsWith('/unread-count')) return json(route, { unreadCount: 0 });
    if (path === '/admin/notifications') return json(route, { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
    if (path === '/admin/users' && method === 'GET') {
      const role = url.searchParams.get('role');
      const status = url.searchParams.get('status');
      const content = data.filter(item => (!role || item.roles.includes(role)) && (!status || item.status === status));
      return json(route, { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0 });
    }
    if (path === '/admin/users' && method === 'POST') {
      const input = body as Record<string, string>;
      return json(route, { userId: 99, username: input.username, fullName: input.fullName, email: input.email ?? null,
        emailVerified: false, phone: input.phone ?? null, roles: ['PARTICIPANT'], status: 'ACTIVE', createdAt: '2026-11-08T01:00:00Z' }, 201);
    }
    const statusMatch = path.match(/^\/admin\/users\/(\d+)\/status$/);
    if (statusMatch && method === 'PATCH') {
      const target = data.find(item => item.userId === Number(statusMatch[1]))!;
      target.status = (body as { status: Account['status'] }).status;
      return json(route, target);
    }
    const roleMatch = path.match(/^\/admin\/users\/(\d+)\/roles\/(\w+)$/);
    if (roleMatch) {
      const target = data.find(item => item.userId === Number(roleMatch[1]))!;
      target.roles = method === 'PUT'
        ? [...target.roles, roleMatch[2]]
        : target.roles.filter(role => role !== roleMatch[2]);
      return json(route, target);
    }
    return json(route, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });
  return calls;
}

test('the account list shows real status, verification and every role', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/users');

  const rows = page.locator('.adm-table tbody tr');
  await expect(rows).toHaveCount(4);
  const partner = rows.filter({ hasText: 'mocmien01' });
  await expect(partner).toContainText('Đối tác');
  await expect(partner).toContainText('Ban tổ chức');
  await expect(partner).toContainText('Người tham gia');
  await expect(partner).toContainText('Hoạt động');
  await expect(rows.filter({ hasText: 'khoa01' })).toContainText('Đã khóa');
  await expect(rows.filter({ hasText: 'chuaxacminh' })).toContainText('Chưa xác minh');
  await expect(page.getByRole('button', { name: 'Chỉnh sửa admin' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Khóa admin' })).toBeDisabled();

  await page.getByRole('combobox', { name: 'Lọc theo trạng thái' }).selectOption('DISABLED');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('khoa01');
});

test('locking needs a reason and a rejected lock changes nothing on screen', async ({ page }) => {
  const calls = await setup(page, { 'PATCH /admin/users/12/status': { status: 409, code: 'LAST_ACTIVE_ADMIN_REQUIRED' } });
  await page.goto('/admin/users');

  await page.getByRole('button', { name: 'Khóa mocmien01' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Xác nhận khóa' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Lý do (10–500 ký tự) *').fill('ngắn');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Lý do (10–500 ký tự) *').fill('  Tài khoản   có dấu hiệu bị lạm dụng.  ');
  await confirm.click();

  await expect(dialog.getByRole('alert')).toContainText('ít nhất một Quản trị viên');
  const request = calls.find(call => call.method === 'PATCH');
  expect(request?.body).toEqual({ status: 'DISABLED', reason: 'Tài khoản có dấu hiệu bị lạm dụng.' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.adm-table tbody tr').filter({ hasText: 'mocmien01' })).toContainText('Hoạt động');
});

test('a confirmed lock and unlock update the row from the server answer', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/users');

  await page.getByRole('button', { name: 'Khóa mocmien01' }).click();
  await page.getByRole('dialog').getByLabel('Lý do (10–500 ký tự) *').fill('Tài khoản có dấu hiệu bị lạm dụng.');
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận khóa' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.adm-table tbody tr').filter({ hasText: 'mocmien01' })).toContainText('Đã khóa');

  await page.getByRole('button', { name: 'Mở khóa khoa01' }).click();
  await page.getByRole('dialog').getByLabel('Lý do (10–500 ký tự) *').fill('Đã xác minh lại chủ tài khoản.');
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận mở khóa' }).click();
  await expect(page.locator('.adm-table tbody tr').filter({ hasText: 'khoa01' })).toContainText('Hoạt động');
});

test('creating an account sends no role, status or default password', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/admin/users');

  await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên đăng nhập *').fill('docgia01');
  await dialog.getByLabel('Họ và tên *').fill('Phạm Văn D');
  await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Mật khẩu');
  expect(calls.some(call => call.method === 'POST')).toBe(false);

  await dialog.getByLabel('Mật khẩu ban đầu *').fill('Secret123!');
  await dialog.getByLabel('Xác nhận mật khẩu *').fill('Secret123!');
  await dialog.getByLabel('Email').fill('d@example.test');
  await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Đã tạo tài khoản docgia01' })).toBeVisible();
  const created = calls.find(call => call.method === 'POST' && call.path === '/admin/users');
  expect(created?.body).toEqual({
    username: 'docgia01', fullName: 'Phạm Văn D', password: 'Secret123!', confirmPassword: 'Secret123!', email: 'd@example.test',
  });
});

test('the role screen explains unavailable actions and reports guard rejections', async ({ page }) => {
  const calls = await setup(page, { 'DELETE /admin/users/12/roles/ORGANIZER': { status: 409, code: 'ORGANIZER_OWNS_OPEN_EVENTS' } });
  await page.goto('/admin/roles');

  const rows = page.locator('.adm-table tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Gỡ vai trò Quản trị viên cho admin' })).toBeDisabled();
  await expect(rows.filter({ hasText: '@admin ·' })).toContainText('tự gỡ vai trò Quản trị viên');
  await expect(page.getByRole('button', { name: 'Gán vai trò Đối tác cho khoa01' })).toBeDisabled();
  await expect(rows.filter({ hasText: 'khoa01' })).toContainText('đang bị khóa');
  await expect(page.getByRole('button', { name: 'Gán vai trò Đối tác cho chuaxacminh' })).toBeDisabled();
  await expect(rows.filter({ hasText: 'chuaxacminh' })).toContainText('chưa được xác minh');

  await page.getByRole('button', { name: 'Gỡ vai trò Ban tổ chức cho mocmien01' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận gỡ' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('vẫn sở hữu sự kiện');
  await page.keyboard.press('Escape');
  await expect(rows.filter({ hasText: 'mocmien01' })).toContainText('Ban tổ chức');

  await page.getByRole('button', { name: 'Gán vai trò Quản trị viên cho mocmien01' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận gán' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'đăng nhập lại' })).toBeVisible();
  expect(calls.some(call => call.method === 'PUT' && call.path === '/admin/users/12/roles/ADMIN')).toBe(true);
});

test('the Admin profile uses /auth/profile and offers no password action', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/admin/profile');

  await expect(page.getByRole('heading', { name: 'Hồ sơ Quản trị viên' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đổi mật khẩu' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
  await page.getByLabel('Số điện thoại').fill('0911111111');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã cập nhật hồ sơ của bạn.')).toBeVisible();

  const update = calls.find(call => call.method === 'PUT' && call.path === '/auth/profile');
  expect(update?.body).toEqual({ fullName: 'Quản trị viên', phone: '0911111111', avatarUrl: null });
  expect(calls.some(call => call.path.startsWith('/admin/profile'))).toBe(false);
});
