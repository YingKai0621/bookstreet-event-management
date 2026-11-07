import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, failSave = false) {
  let profile = { id: 42, fullName: 'Bạn Đọc Mới', email: null, phone: null as string | null, avatarUrl: null as string | null };
  await page.addInitScript(() => localStorage.setItem('duongsach_participant_profile', JSON.stringify({
    id: '1', name: 'Tên Độc Giả Cũ', avatar: 'https://example.com/old-avatar.png', email: 'old@example.com',
  })));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/me')) body = { userId: 42, username: 'newreader', fullName: profile.fullName, email: null, emailVerified: false, status: 'ACTIVE', roles: ['PARTICIPANT'] };
    else if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test-token' };
    else if (path.endsWith('/participant/notifications')) body = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    else if (path.endsWith('/participant/notifications/unread-count')) body = { unreadCount: 0 };
    else if (path.endsWith('/events')) body = { content: [], totalElements: 0, totalPages: 0 };
    else if (path.endsWith('/auth/profile')) {
      if (route.request().method() === 'PUT') {
        expect(route.request().headers()['x-xsrf-token']).toBe('test-token');
        if (failSave) { status = 503; body = { code: 'UNAVAILABLE', message: 'Không lưu được vào database' }; }
        else { profile = { ...profile, ...route.request().postDataJSON() }; body = profile; }
      } else body = profile;
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('new account ignores previous reader name and avatar in browser storage', async ({ page }) => {
  await setup(page);
  await page.goto('/participant/profile');
  await expect(page.getByRole('heading', { name: 'Bạn Đọc Mới', exact: true })).toBeVisible();
  await expect(page.getByText('Tên Độc Giả Cũ')).toHaveCount(0);
  await expect(page.locator('img[src="https://example.com/old-avatar.png"]')).toHaveCount(0);
  await expect(page.getByText('old@example.com')).toHaveCount(0);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const fitsWidth = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fitsWidth, `Profile should not overflow horizontally at ${viewport.width}px`).toBe(true);
  }
});

test('name and uploaded avatar are saved through API and survive reload', async ({ page }) => {
  await setup(page);
  await page.goto('/participant/profile');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('.profile-details-table input').first().fill('Tên Đã Lưu');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu thay đổi hồ sơ thành công!')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1cAAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('.profile-avatar-large img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tên Đã Lưu', exact: true })).toBeVisible();
  await expect(page.locator('.profile-avatar-large img')).toHaveAttribute('src', /^data:image\/png;base64,/);
});

test('failed database write shows an error without a success message', async ({ page }) => {
  await setup(page, true);
  await page.goto('/participant/profile');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('.profile-details-table input').first().fill('Tên Không Lưu');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không lưu được vào database');
  await expect(page.getByText('Đã lưu thay đổi hồ sơ thành công!')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bạn Đọc Mới', exact: true })).toBeVisible();
});

test('participant registration tabs and search are restored from the URL', async ({ page }) => {
  await setup(page);
  await page.goto('/participant/activities?status=cancelled&search=workshop');

  await expect(page.getByRole('button', { name: /Đã hủy/ })).toHaveClass(/is-active/);
  await expect(page).toHaveURL(/status=cancelled/);
  await expect(page).toHaveURL(/search=workshop/);

  await page.getByRole('button', { name: /Đã điểm danh/ }).click();
  await expect(page).toHaveURL(/status=attended/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Đã điểm danh/ })).toHaveClass(/is-active/);
});
