import { test, expect, type Page } from '@playwright/test';

test('badge image upload keeps upload below the URL and preview on the right', async ({ page }) => {
  await setup(page, 'badges');
  const imagePath = '/api/v1/media/badge-images/12345678-1234-1234-1234-123456789abc.png';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1cAAAAASUVORK5CYII=', 'base64');
  await page.route('**/admin/badge-images', async route => {
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    await route.fulfill({ status: 201, json: { url: imagePath } });
  });
  await page.route(`**${imagePath}`, route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.goto('/admin/badges');
  await page.getByRole('button', { name: 'Thêm huy hiệu' }).click();
  const dialog = page.getByRole('dialog');
  const url = dialog.getByRole('textbox', { name: 'Đường dẫn ảnh', exact: true });
  const upload = dialog.getByRole('button', { name: 'Chọn ảnh từ máy', exact: true });
  const urlBounds = await url.boundingBox();
  const uploadBounds = await upload.boundingBox();
  expect(uploadBounds!.y).toBeGreaterThanOrEqual(urlBounds!.y + urlBounds!.height);
  const previewBounds = await dialog.locator('.image-url-field-preview').boundingBox();
  expect(previewBounds!.x).toBeGreaterThan(urlBounds!.x + urlBounds!.width);
  expect(Math.abs(previewBounds!.y - urlBounds!.y)).toBeLessThanOrEqual(2);
  await dialog.locator('input[type=file]').setInputFiles({ name: 'badge.png', mimeType: 'image/png', buffer: png });
  await expect(url).toHaveValue(new RegExp(imagePath));
  await expect(dialog.getByAltText('Ảnh xem trước')).toBeVisible();
  await expect(dialog.getByAltText('Ảnh xem trước')).toHaveJSProperty('naturalWidth', 1);
  await page.screenshot({ path: test.info().outputPath('badge-upload-preview.png') });
  await dialog.getByRole('textbox', { name: 'Tên huy hiệu', exact: true }).fill('Huy hiệu ảnh');
  const saved = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/admin/badges'));
  await page.route('**/admin/badges', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ json: { badge: { name: 'Huy hiệu ảnh' }, synchronizationTriggered: false } });
    else await route.fallback();
  });
  await dialog.getByRole('button', { name: 'Lưu huy hiệu' }).click();
  expect((await saved).postDataJSON().iconUrl).toMatch(new RegExp(imagePath));
});

test('badge upload rejects unsupported files and allows retry after server failure', async ({ page }) => {
  await setup(page, 'badges');
  await page.route('**/admin/badge-images', route => route.fulfill({ status: 500, json: { code: 'IMAGE_STORAGE_FAILED', message: 'failed' } }));
  await page.goto('/admin/badges');
  await page.getByRole('button', { name: 'Thêm huy hiệu' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'file.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(dialog.getByRole('alert')).toContainText('Chọn ảnh JPG');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from('test') });
  await expect(dialog.getByRole('alert')).toContainText('Không tải được ảnh');
  await expect(dialog.getByRole('button', { name: 'Chọn ảnh từ máy' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
async function setup(page: Page, _tab: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/me')) body = { userId: 1, fullName: 'Admin Test', username: 'admin', roles: ['ADMIN'], email: 'admin@example.com', emailVerified: true, status: 'ACTIVE' };
    else if (path.endsWith('/auth/profile')) body = { id: 1, fullName: 'Admin Test', email: 'admin@example.com', phone: '0901234567', avatarUrl: null, emailVerified: true };
    else if (path.endsWith('/admin/users')) body = {
      content: Array.from({ length: 20 }, (_, i) => ({
        userId: i + 1, username: `reader${i + 1}`, fullName: `Độc giả ${i + 1}`, email: `reader${i + 1}@example.com`,
        emailVerified: i % 2 === 0, phone: null, roles: i === 0 ? ['PARTICIPANT', 'ADMIN'] : ['PARTICIPANT', 'PARTNER'],
        status: i % 5 === 0 ? 'DISABLED' : 'ACTIVE', createdAt: '2026-10-14T01:00:00Z',
      })),
      page: 0, size: 20, totalElements: 20, totalPages: 1,
    };
    else if (path.endsWith('/admin/notifications/unread-count')) body = { unreadCount: 0 };
    else if (path.endsWith('/admin/notifications')) body = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    else if (path.endsWith('/events')) body = { content: [], totalPages: 0 };
    else if (path.endsWith('/admin/dashboard')) body = {};
    else if (path.endsWith('/admin/audit-logs')) {
      const requested = Number(new URL(route.request().url()).searchParams.get('page') || 0);
      body = { content: Array.from({ length: 20 }, (_, i) => ({
        auditLogId: requested * 20 + i + 1,
        actor: { userId: 1, username: 'admin', fullName: 'Admin Test' },
        action: 'USER_LOCKED', targetType: 'USER', targetId: i + 1, targetLabel: `user${i}`,
        reason: 'Tài khoản có dấu hiệu lạm dụng.', details: { from: 'ACTIVE', to: 'DISABLED' },
        createdAt: '2026-10-14T01:00:00Z',
      })), page: requested, size: 20, totalElements: 40, totalPages: 2 };
    }
    else if (path.endsWith('/admin/badge-rules') || path.endsWith('/admin/badges')) body = {
      content: Array.from({ length: 12 }, (_, i) => ({
        badgeId: i + 1,
        name: `Huy hiệu ${i}`,
        description: 'Hoàn thành hoạt động để tích lũy điểm.',
        requiredPoints: i * 100,
        iconUrl: null,
        isActive: true,
        awardedUserCount: 0,
        remainingEligibleCount: 0,
        createdAt: '2026-10-14T01:00:00Z',
        updatedAt: '2026-10-14T01:00:00Z',
      })),
      page: 0,
      size: 20,
      totalElements: 12,
      totalPages: 1,
    };
    else if (path.endsWith('/organizer/booths')) body = { content: Array.from({ length: 40 }, (_, i) => ({ boothId: i + 1, code: `A${i}`, name: `Gian hàng ${i}`, categoryCode: 'BOOK', maxCapacity: 10, active: true })), page: 0, totalPages: 1, totalElements: 40 };
    else if (path.endsWith('/organizer/locations')) body = { content: [], page: 0, size: 100, totalPages: 0, totalElements: 0 };
    await route.fulfill({ json: body });
  });
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
for (const tab of ['audit', 'badges', 'profile', 'users', 'roles']) {
  test(`${tab} layout fits ${viewport.width}x${viewport.height} and uses Be Vietnam Pro`, async ({ page }) => {
    await setup(page, tab); await page.goto(`/admin/${tab}`);
    await page.setViewportSize(viewport);
    await expect(page.locator('.admin-main-viewport')).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: test.info().outputPath(`${tab}.png`), fullPage: true });
    const metrics = await page.locator('.admin-main-viewport').evaluate(el => ({
      scrollWidth: el.scrollWidth,
      width: el.clientWidth,
      font: getComputedStyle(el).fontFamily,
    }));
    expect(metrics.font).toContain('Be Vietnam Pro');
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1);
    if (tab === 'audit') {
      await expect(page.getByRole('navigation', { name: 'pagination' })).toBeVisible();
      await page.getByRole('link', { name: 'Trang sau', exact: true }).click();
      await expect(page.getByRole('navigation', { name: 'pagination' }).locator('[aria-current=page]')).toHaveText('2');
    }
    if (tab === 'profile') {
      await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
      expect(await page.locator('.admin-main-viewport').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.getByRole('button', { name: 'Hủy', exact: true }).first().click();
      await expect(page.getByRole('button', { name: 'Đổi mật khẩu' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Đăng xuất', exact: true }).last().click();
      await expect(page.locator('.adm-modal-overlay')).toBeVisible();
      expect(['hidden', 'clip']).toContain(await page.evaluate(() => document.body.style.overflow));
      await page.keyboard.press('Escape');
      await expect(page.locator('.adm-modal-overlay')).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toMatch(/^(hidden|clip)$/);
    }
    if (tab === 'audit') {
      await page.getByRole('button', { name: /Xem chi tiết nhật ký/ }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(['hidden', 'clip']).toContain(await page.evaluate(() => document.body.style.overflow));
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toMatch(/^(hidden|clip)$/);
    }
    if (tab === 'badges') {
      await page.getByRole('button', { name: /Thêm (huy hiệu|quy tắc mới)/ }).click();
      await expect(page.locator('.adm-modal-overlay')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.adm-modal-overlay')).toHaveCount(0);
    }
  });
}
}


test('admin canonical routes control the screen and browser history', async ({ page }) => {
  await setup(page, 'dashboard');
  await page.addInitScript(() => localStorage.setItem('admin_active_tab', 'profile'));
  await page.goto('/admin/users');

  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('button', { name: 'Quản lý người dùng', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Nhật ký hệ thống', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/users$/);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Quản lý người dùng', exact: true })).toHaveAttribute('aria-current', 'page');
});
