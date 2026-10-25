import { expect, test } from '@playwright/test';

test('Shared list pagination keeps all results reachable and resets after searching', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/me')) body = { userId: 1, fullName: 'Admin Test', username: 'admin', roles: ['ADMIN'], email: 'admin@example.com', emailVerified: true, status: 'ACTIVE' };
    else if (path.endsWith('/admin/profile')) body = { id: 1, fullName: 'Admin Test', email: 'admin@example.com', department: 'Quản trị hệ thống' };
    else if (path.endsWith('/events')) body = { content: [], totalPages: 0 };
    else if (path.endsWith('/admin/dashboard')) body = {};
    else if (path.endsWith('/admin/users')) body = Array.from({ length: 23 }, (_, index) => ({
      id: String(index + 1), code: `USER-${index + 1}`, fullName: `Độc giả ${String(index + 1).padStart(2, '0')}`,
      email: `reader${index + 1}@example.com`, primaryRole: 'PARTICIPANT', status: 'ACTIVE',
    }));
    await route.fulfill({ json: body });
  });
  await page.goto('/admin/users');
  const rows = page.locator('.adm-table tbody tr');
  const controls = page.getByRole('navigation', { name: 'pagination', exact: true });
  await expect(rows).toHaveCount(10);
  await expect(controls.locator('[aria-current=page]')).toHaveText('1');
  await expect(controls.getByRole('link', { name: 'Trang trước', exact: true })).toBeDisabled();
  await controls.getByRole('link', { name: 'Trang sau', exact: true }).click();
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Độc giả 11');
  await controls.getByRole('link', { name: 'Trang sau', exact: true }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.last()).toContainText('Độc giả 23');
  await expect(controls.getByRole('link', { name: 'Trang sau', exact: true })).toBeDisabled();
  await controls.getByRole('link', { name: 'Trang trước', exact: true }).click();
  await expect(rows.first()).toContainText('Độc giả 11');
  const search = page.getByPlaceholder('Tìm theo tên, email, số điện thoại hoặc mã...');
  await search.fill('Độc giả 23');
  await expect(rows).toHaveCount(1);
  await expect(controls.locator('[aria-current=page]')).toHaveText('1');
  await search.fill('');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Độc giả 01');
  await search.fill('Không có tài khoản');
  await expect(controls).toHaveCount(0);
  await expect(page.getByText('Không tìm thấy tài khoản nào', { exact: false })).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`Public event cards paginate without overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } });
      if (path.endsWith('/events')) return route.fulfill({ json: {
        content: Array.from({ length: 23 }, (_, index) => ({ eventId: index + 1,
          name: `Sự kiện ${String(index + 1).padStart(2, '0')}`, description: 'Hoạt động tại đường sách',
          startAt: '2027-03-20T02:00:00Z', endAt: '2027-03-21T10:00:00Z',
          participantRegistrationDeadlineAt: '2027-03-18T10:00:00Z', bannerUrl: null, status: 'PUBLISHED' })),
        page: 0, size: 100, totalElements: 23, totalPages: 1,
      } });
      return route.fulfill({ json: path.endsWith('/booths') ? { content: [], totalPages: 0 } : [] });
    });
    await page.goto('/su-kien');
    const cards = page.locator('.events-collection-grid .event-card-item');
    const controls = page.getByRole('navigation', { name: 'pagination', exact: true });
    await expect(cards).toHaveCount(10);
    await controls.getByRole('link', { name: 'Trang sau', exact: true }).click();
    await expect(cards.first()).toContainText('Sự kiện 11');
    await controls.getByRole('link', { name: 'Trang sau', exact: true }).click();
    await expect(cards).toHaveCount(3);
    await expect(controls.getByRole('link', { name: 'Trang sau', exact: true })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Tìm kiếm sự kiện', exact: true }).fill('Sự kiện 23');
    await expect(cards).toHaveCount(1);
    await expect(controls.locator('[aria-current=page]')).toHaveText('1');
    const bounds = await controls.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, viewport: window.innerWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
    await page.screenshot({ path: test.info().outputPath('pagination.png'), fullPage: true });
  });
}
