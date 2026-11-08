import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown) {
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

async function signInAs(page: Page, roles: string[]) {
  const emptyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-XSRF-TOKEN', token: 'test' });
    if (path.endsWith('/auth/me')) {
      return json(route, {
        userId: 7, username: 'staff', fullName: 'Nguyễn Văn Nhân', email: 'staff@example.test',
        emailVerified: true, status: 'ACTIVE', roles,
      });
    }
    if (path.endsWith('/auth/profile')) {
      return json(route, { id: 7, fullName: 'Nguyễn Văn Nhân', email: 'staff@example.test', emailVerified: true, phone: null, avatarUrl: null });
    }
    if (path.endsWith('/unread-count')) return json(route, { unreadCount: 0 });
    if (path.endsWith('/admin/dashboard')) {
      return json(route, { accounts: { total: 0, byRole: { PARTICIPANT: 0, PARTNER: 0, ORGANIZER: 0, ADMIN: 0 }, byStatus: { ACTIVE: 0, DISABLED: 0 } }, events: { total: 0, byStatus: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 } }, activeBoothAssignments: 0, boothRevenue: 0, auditByDay: Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-0${index + 1}`, count: 0 })) });
    }
    if (path.endsWith('/admin/users')) return json(route, emptyPage);
    if (path.endsWith('/organizer/dashboard')) {
      return json(route, {
        activeEventCount: 0, pendingPartnerApplicationCount: 0, pendingBoothRequestCount: 0,
        eventStatusCounts: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 },
        partnerApplicationStatusCounts: { PENDING: 0, APPROVED: 0, REJECTED: 0, WITHDRAWN: 0 }, priorityTasks: [],
      });
    }
    return json(route, emptyPage);
  });
}

async function openAccountMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tài khoản của tôi' }).click();
  return page.getByRole('menu');
}

test('an Admin sees the Admin workspace in the landing menu, not the reader menu', async ({ page }) => {
  await signInAs(page, ['PARTICIPANT', 'ADMIN']);
  const menu = await openAccountMenu(page);

  await expect(menu).toContainText('Quản trị viên');
  await expect(menu.getByRole('menuitem', { name: 'Trang quản trị' })).toHaveAttribute('href', '/admin');
  for (const readerItem of ['Sự kiện của tôi', 'Điểm & Huy hiệu', 'Chứng nhận']) {
    await expect(menu.getByRole('menuitem', { name: readerItem })).toHaveCount(0);
  }
  await expect(menu).not.toContainText('Độc giả');
});

test('an account with several staff roles sees each staff workspace', async ({ page }) => {
  await signInAs(page, ['PARTICIPANT', 'ORGANIZER', 'PARTNER']);
  const menu = await openAccountMenu(page);

  await expect(menu).toContainText('Ban tổ chức');
  await expect(menu.getByRole('menuitem', { name: 'Khu Ban tổ chức' })).toHaveAttribute('href', '/organizer');
  await expect(menu.getByRole('menuitem', { name: 'Khu Đối tác' })).toHaveAttribute('href', '/partner');
});

for (const [roles, home] of [
  [['PARTICIPANT', 'ADMIN'], /\/admin$/],
  [['PARTICIPANT', 'ORGANIZER', 'PARTNER'], /\/organizer$/],
  [['PARTICIPANT', 'PARTNER'], /\/partner$/],
] as const) {
  test(`a staff account opening a reader URL goes to ${String(home)}`, async ({ page }) => {
    await signInAs(page, [...roles]);
    await page.goto('/participant/rewards');

    await expect(page).toHaveURL(home);
  });
}

test('a reader-only account keeps the reader menu and workspace', async ({ page }) => {
  await signInAs(page, ['PARTICIPANT']);
  const menu = await openAccountMenu(page);

  await expect(menu).toContainText('Độc giả');
  await expect(menu.getByRole('menuitem', { name: 'Sự kiện của tôi' })).toBeVisible();
  await page.goto('/participant/rewards');
  await expect(page).toHaveURL(/\/participant\/rewards$/);
});

for (const [roles, path, bar] of [
  [['PARTICIPANT', 'ADMIN'], '/admin', '.admin-topbar'],
  [['PARTICIPANT', 'PARTNER'], '/partner', '.partner-top-bar'],
] as const) {
  test(`the ${path} workspace links to the public site in a new tab`, async ({ page }) => {
    await signInAs(page, [...roles]);
    await page.goto(path);

    const link = page.locator(bar).getByRole('link', { name: 'Xem trang công khai' });
    await expect(link).toHaveAttribute('href', '/');
    await expect(link).toHaveAttribute('target', '_blank');
  });
}
