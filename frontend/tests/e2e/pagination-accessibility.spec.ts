import { expect, test } from '@playwright/test';

test('Pagination exposes numbered links, ellipses, current page and disabled boundaries', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/me')) body = { userId: 1, fullName: 'Admin Test', username: 'admin', roles: ['ADMIN'], email: 'admin@example.com', emailVerified: true, status: 'ACTIVE' };
    else if (path.endsWith('/admin/profile')) body = { id: 1, fullName: 'Admin Test', email: 'admin@example.com', department: 'Quản trị hệ thống' };
    else if (path.endsWith('/events')) body = { content: [], totalPages: 0 };
    else if (path.endsWith('/admin/dashboard')) body = {};
    else if (path.endsWith('/admin/users')) body = Array.from({ length: 80 }, (_, index) => ({
      id: String(index + 1), code: `USER-${index + 1}`, fullName: `Độc giả ${String(index + 1).padStart(2, '0')}`,
      email: `reader${index + 1}@example.com`, primaryRole: 'PARTICIPANT', status: 'ACTIVE',
    }));
    await route.fulfill({ json: body });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/users');
  const pagination = page.getByRole('navigation', { name: 'pagination', exact: true });
  await expect(pagination.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('1');
  await expect(pagination.getByRole('link', { name: 'Trang trước' })).toBeDisabled();
  await pagination.getByRole('link', { name: 'Trang 2', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('2');
  await expect(pagination.locator('.list-pagination-link').filter({ hasText: '8' })).toHaveAttribute('href', /[?&]page=8/);
  await expect(pagination.locator('.list-pagination-ellipsis')).toContainText('…');
  await expect(pagination.getByRole('link', { name: 'Trang 4', exact: true })).toHaveCount(0);
  await expect(page.locator('.adm-table tbody tr').first()).toContainText('Độc giả 11');
  await page.screenshot({ path: test.info().outputPath('pagination-page-2.png'), fullPage: true });
  await pagination.getByRole('link', { name: 'Trang 8', exact: true }).click();
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('8');
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  await expect(page.locator('.adm-table tbody tr').last()).toContainText('Độc giả 80');
  await page.getByPlaceholder('Tìm theo tên, email, số điện thoại hoặc mã...').fill('Độc giả 01');
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('1');
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  await expect(pagination.locator('.list-pagination-ellipsis')).toHaveCount(0);
});
