import { test, expect, type Page } from '@playwright/test';
async function setup(page: Page, tab: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(tab => localStorage.setItem('admin_active_tab', tab), tab);
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/me')) body = { userId: 1, fullName: 'Admin Test', username: 'admin', roles: ['ADMIN'], email: 'admin@example.com', emailVerified: true, status: 'ACTIVE' };
    else if (path.endsWith('/admin/profile')) body = { id: 1, fullName: 'Admin Test', email: 'admin@example.com', phone: '0901234567', department: 'Quản trị hệ thống', lastActiveAt: '2026-10-14T01:00:00Z' };
    else if (path.endsWith('/events')) body = { content: [], totalPages: 0 };
    else if (path.endsWith('/admin/dashboard')) body = {};
    else if (path.endsWith('/admin/audit-logs')) body = Array.from({ length: 40 }, (_, i) => ({ id: String(i), createdAt: '2026-10-14T01:00:00Z', actor: { fullName: 'Admin Test', primaryRole: 'ADMIN' }, action: 'update', targetType: `User ${i}`, details: 'Cập nhật thông tin tài khoản', status: 'success', ipAddress: '127.0.0.1' }));
    else if (path.endsWith('/admin/badge-rules')) body = Array.from({ length: 12 }, (_, i) => ({ id: String(i), code: `BADGE${i}`, name: `Huy hiệu ${i}`, nameEn: `Badge ${i}`, title: 'Huy hiệu kiểm thử', iconName: 'award', minPoints: i * 100, status: 'active', statusLabelVi: 'Đang áp dụng', description: 'Hoàn thành hoạt động để tích lũy điểm.', perks: ['Ưu tiên hoạt động', 'Quà tặng sự kiện'] }));
    else if (path.endsWith('/organizer/booths')) body = { content: Array.from({ length: 40 }, (_, i) => ({ boothId: i + 1, code: `A${i}`, name: `Gian hàng ${i}`, categoryCode: 'BOOK', maxCapacity: 10, active: true })), page: 0, totalPages: 1, totalElements: 40 };
    await route.fulfill({ json: body });
  });
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
for (const tab of ['booths', 'audit', 'badges', 'profile']) {
  test(`${tab} layout fits ${viewport.width}x${viewport.height} and uses Nunito`, async ({ page }) => {
    await setup(page, tab); await page.goto('/admin');
    await page.setViewportSize(viewport);
    await expect(page.locator('.admin-main-viewport')).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: test.info().outputPath(`${tab}.png`), fullPage: true });
    const metrics = await page.locator('.admin-main-viewport').evaluate(el => ({ scroll: el.scrollHeight, height: el.clientHeight, bottom: el.getBoundingClientRect().bottom, font: getComputedStyle(el).fontFamily }));
    expect(metrics.font).toContain('Nunito');
    expect(metrics.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.height + 1);
    if (tab === 'audit' || tab === 'booths') {
      await expect(page.getByRole('navigation', { name: 'Phân trang' })).toBeVisible();
      await page.getByRole('button', { name: 'Sau', exact: true }).click();
      await expect(page.getByRole('navigation', { name: 'Phân trang' })).toContainText('Trang 2/');
    }
    if (tab === 'profile') {
      await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
      expect(await page.locator('.admin-main-viewport').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(viewport.height + 1);
      await page.getByRole('button', { name: 'Hủy', exact: true }).first().click();
      await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
      await expect(page.locator('.adm-modal-overlay')).toBeVisible();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await expect(page.locator('.adm-modal-overlay')).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    }
    if (tab === 'audit') {
      await page.getByRole('button', { name: /Xem chi tiết nhật ký/ }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    }
    if (tab === 'booths') {
      await page.getByRole('button', { name: 'Thêm gian hàng mới' }).click();
      await expect(page.locator('.booth-modal-backdrop')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.booth-modal-backdrop')).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    }
    if (tab === 'badges') {
      await page.getByRole('button', { name: 'Thêm quy tắc mới' }).click();
      await expect(page.locator('.adm-modal-overlay')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.adm-modal-overlay')).toHaveCount(0);
    }
  });
}
}


test('booth access denial is not displayed as an empty catalog', async ({ page }) => {
  await setup(page, 'booths');
  await page.route('**/api/v1/organizer/booths?**', route => route.fulfill({ status: 403, json: { code: 'ACCESS_DENIED', message: 'You do not have permission to access this resource.' } }));
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Chưa có quyền truy cập danh mục' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm gian hàng mới' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tạo gian hàng đầu tiên' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Phân trang' })).toHaveCount(0);
  await expect(page.locator('.booth-kpi-info strong').first()).toHaveText('—');
});

test('booth search without matches offers filter reset instead of first booth creation', async ({ page }) => {
  await setup(page, 'booths');
  await page.goto('/admin');
  await page.locator('.booth-search-box input').fill('no-such-booth');
  await expect(page.getByRole('heading', { name: 'Không có kết quả phù hợp' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo gian hàng đầu tiên' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(page.locator('.booth-table')).toBeVisible();
});
