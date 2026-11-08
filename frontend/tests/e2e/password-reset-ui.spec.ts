import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, confirmStatus = 204) {
  const state = { requests: [] as unknown[], confirmations: [] as unknown[] };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let status = 200;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'csrf-test' };
    else if (path.endsWith('/auth/me')) {
      status = 401;
      body = { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' };
    } else if (path.endsWith('/password-reset/request')) {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-xsrf-token']).toBe('csrf-test');
      state.requests.push(route.request().postDataJSON());
      status = 202;
      body = { message: 'Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.' };
    } else if (path.endsWith('/password-reset/confirm')) {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-xsrf-token']).toBe('csrf-test');
      state.confirmations.push(route.request().postDataJSON());
      status = confirmStatus;
      body = { code: 'INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN', message: 'Liên kết không hợp lệ hoặc đã hết hạn' };
    }
    await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(body) });
  });
  return state;
}

test('login links to the request form, which always answers neutrally', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/login');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);

  await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click();
  await expect(page.getByRole('alert')).toContainText('email hợp lệ');
  expect(state.requests).toHaveLength(0);

  await page.getByLabel('Email').fill('  reader@example.com ');
  await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click();
  await expect(page.getByRole('status')).toContainText('Nếu email này thuộc một tài khoản đã xác minh');
  expect(state.requests).toEqual([{ email: 'reader@example.com' }]);
});

test('a valid link sets the new password and removes the token from the address bar', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/reset-password?token=sample-token');

  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click();
  await expect(page.getByRole('alert')).toContainText('từ 8 đến 64 ký tự');

  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewSecret123');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('Different123');
  await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click();
  await expect(page.getByRole('alert')).toContainText('chưa khớp');
  expect(state.confirmations).toHaveLength(0);

  await page.getByLabel('Nhập lại mật khẩu mới').fill('NewSecret123');
  await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click();
  await expect(page.getByRole('status')).toContainText('Mật khẩu mới đã có hiệu lực');
  expect(state.confirmations).toEqual([{ token: 'sample-token', newPassword: 'NewSecret123', confirmPassword: 'NewSecret123' }]);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('a rejected or missing link offers a new request', async ({ page }) => {
  const state = await setup(page, 400);
  await page.goto('/reset-password?token=used-token');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewSecret123');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('NewSecret123');
  await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click();
  await expect(page.getByRole('alert')).toContainText('đã hết hạn hoặc đã được dùng');
  expect(state.confirmations).toHaveLength(1);

  await page.goto('/reset-password');
  await expect(page.getByRole('heading', { name: 'Liên kết không còn hiệu lực' })).toBeVisible();
  await page.getByRole('link', { name: 'Yêu cầu liên kết mới' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  expect(state.confirmations).toHaveLength(1);
});
