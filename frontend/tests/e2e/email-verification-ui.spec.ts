import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, verified = false, failure = false) {
  const state = { verified, resends: 0, confirmations: 0 };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'csrf-test' };
    else if (path.endsWith('/auth/me')) body = { userId: 42, username: 'reader', fullName: 'Bạn Đọc', email: 'reader@example.com', emailVerified: state.verified, status: 'ACTIVE', roles: ['PARTICIPANT'] };
    else if (path.endsWith('/auth/profile')) body = { id: 42, fullName: 'Bạn Đọc', email: 'reader@example.com', emailVerified: state.verified, avatarUrl: null };
    else if (path.endsWith('/events')) body = { content: [] };
    else if (path.endsWith('/email-verification/resend')) {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-xsrf-token']).toBe('csrf-test');
      expect(route.request().postData()).toBeNull();
      state.resends++;
      status = failure ? 429 : 204;
      body = { code: 'EMAIL_VERIFICATION_RATE_LIMITED', message: 'Vui lòng chờ trước khi gửi lại' };
    } else if (path.endsWith('/email-verification/confirm')) {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-xsrf-token']).toBe('csrf-test');
      expect(route.request().postDataJSON()).toEqual({ token: 'sample-token' });
      state.confirmations++;
      status = failure ? 400 : 204;
      body = { code: 'INVALID_OR_EXPIRED_VERIFICATION_TOKEN', message: 'Liên kết không hợp lệ hoặc đã hết hạn' };
      if (!failure) state.verified = true;
    }
    await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(body) });
  });
  return state;
}

test('unverified email sends verification and hides button after confirmation', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/participant/profile');
  await page.getByRole('button', { name: 'Xác nhận email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi email xác nhận');
  expect(state.resends).toBe(1);
  await page.goto('/verify-email?token=sample-token');
  expect(state.confirmations).toBe(0);
  await page.getByRole('button', { name: 'Xác nhận email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Email đã được xác nhận thành công');
  expect(state.confirmations).toBe(1);
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByRole('link', { name: 'Về hồ sơ cá nhân' }).click();
  await expect(page.getByText('Đã xác nhận', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận email', exact: true })).toHaveCount(0);
});

test('verified account has no resend button', async ({ page }) => {
  await setup(page, true);
  await page.goto('/participant/profile');
  await expect(page.getByText('Đã xác nhận', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận email' })).toHaveCount(0);
});

test('invalid link shows generic error and missing token does not submit', async ({ page }) => {
  const state = await setup(page, false, true);
  await page.goto('/verify-email?token=sample-token');
  await page.getByRole('button', { name: 'Xác nhận email', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Liên kết không hợp lệ hoặc đã hết hạn');
  await page.goto('/verify-email');
  await expect(page.getByText(/Liên kết thiếu mã xác nhận/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận email' })).toHaveCount(0);
  expect(state.confirmations).toBe(1);
});

test('resend rate limit is displayed without marking email verified', async ({ page }) => {
  await setup(page, false, true);
  await page.goto('/participant/profile');
  await page.getByRole('button', { name: 'Xác nhận email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Vui lòng chờ');
  await expect(page.getByText('Đã xác nhận', { exact: true })).toHaveCount(0);
});

for (const scenario of [ { email: 'new@example.com', loginFails: false }, { email: 'new@example.com', loginFails: true }, { email: '', loginFails: false } ]) {
  test(`registration routes to verification only with email (email=${Boolean(scenario.email)}, loginFailure=${scenario.loginFails})`, async ({ page }) => {
    let loggedIn = false;
    let registrations = 0;
    const account = { userId: 44, username: 'newreader', fullName: 'Bạn Đọc Mới', email: scenario.email || null, emailVerified: false, status: 'ACTIVE', roles: ['PARTICIPANT'] };
    await setup(page);
    await page.route('**/api/v1/auth/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/csrf')) return route.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: 'csrf-test' } });
      if (path.endsWith('/register')) { registrations++; return route.fulfill({ status: 201, json: account }); }
      if (path.endsWith('/login')) {
        if (scenario.loginFails) return route.fulfill({ status: 503, json: { message: 'Session unavailable' } });
        loggedIn = true; return route.fulfill({ json: { user: account } });
      }
      if (path.endsWith('/me')) return route.fulfill({ status: loggedIn ? 200 : 401, json: loggedIn ? account : { code: 'AUTHENTICATION_REQUIRED' } });
      if (path.endsWith('/profile')) return route.fulfill({ json: { ...account, id: 44 } });
      return route.fallback();
    });
    await page.goto('/register');
    await page.locator('#reg-username').fill('newreader');
    await page.locator('#reg-fullname').fill('Bạn Đọc Mới');
    if (scenario.email) await page.locator('#reg-email').fill(scenario.email);
    await page.locator('#reg-password').fill('TestPassword123!');
    await page.locator('#reg-confirm-password').fill('TestPassword123!');
    await page.locator('input[type=checkbox]').check();
    await page.locator('button[type=submit]').click();
    if (scenario.email) {
      await expect(page).toHaveURL(/\/verify-email\?pending=1$/);
      await expect(page.getByRole('heading', { name: 'Kiểm tra hộp thư của bạn' })).toBeVisible();
      await expect(page.getByText('new@example.com', { exact: true })).toBeVisible();
      if (scenario.loginFails) await expect(page.getByRole('link', { name: 'Đăng nhập để gửi lại email' })).toBeVisible();
      else await expect(page.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled();
      await page.screenshot({ path: test.info().outputPath('verification-waiting.png'), fullPage: true });
    } else await expect(page).toHaveURL(/\/login$/);
    expect(registrations).toBe(1);
  });
}
