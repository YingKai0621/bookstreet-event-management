import { expect, test } from '@playwright/test';

function adminUserPage(url: URL, total: number) {
  const page = Number(url.searchParams.get('page') || 0);
  const size = Number(url.searchParams.get('size') || 20);
  const search = (url.searchParams.get('search') || '').toLowerCase();
  const all = Array.from({ length: total }, (_, index) => ({
    userId: index + 1, username: `reader${index + 1}`, fullName: `Độc giả ${String(index + 1).padStart(2, '0')}`,
    email: `reader${index + 1}@example.com`, emailVerified: true, phone: null, roles: ['PARTICIPANT'],
    status: 'ACTIVE', createdAt: '2026-10-14T01:00:00Z',
  })).filter(user => !search || user.fullName.toLowerCase().includes(search));
  return {
    content: all.slice(page * size, page * size + size),
    page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size),
  };
}

test('Pagination exposes numbered links, ellipses, current page and disabled boundaries', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/me')) body = { userId: 1, fullName: 'Admin Test', username: 'admin', roles: ['ADMIN'], email: 'admin@example.com', emailVerified: true, status: 'ACTIVE' };
    else if (path.endsWith('/auth/profile')) body = { id: 1, fullName: 'Admin Test', email: 'admin@example.com', phone: null, avatarUrl: null, emailVerified: true };
    else if (path.endsWith('/events')) body = { content: [], totalPages: 0 };
    else if (path.endsWith('/admin/dashboard')) body = {};
    else if (path.endsWith('/admin/users')) body = adminUserPage(new URL(route.request().url()), 160);
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
  await expect(page.locator('.adm-table tbody tr').first()).toContainText('Độc giả 21');
  await page.screenshot({ path: test.info().outputPath('pagination-page-2.png'), fullPage: true });
  await pagination.getByRole('link', { name: 'Trang 8', exact: true }).click();
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('8');
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  await expect(page.locator('.adm-table tbody tr').last()).toContainText('Độc giả 160');
  await page.getByPlaceholder('Tìm theo tên đăng nhập, họ tên hoặc email...').fill('Độc giả 01');
  await expect(page.locator('.adm-table tbody tr')).toHaveCount(1);
  // A single page of results needs no pagination controls.
  await expect(pagination).toHaveCount(0);
});
