import { expect, test, type Page } from '@playwright/test';

async function mockWorkspace(page: Page, role: 'ADMIN' | 'PARTICIPANT') {
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test-token' };
    else if (path.endsWith('/auth/me')) body = { userId: 1, username: 'testreader', fullName: 'Tài khoản kiểm thử', email: 'reader@example.com', emailVerified: true, status: 'ACTIVE', roles: [role] };
    else if (path.endsWith('/auth/profile')) body = { id: 1, fullName: 'Tài khoản kiểm thử', email: 'reader@example.com' };
    else if (path.endsWith('/admin/profile')) body = { id: 1, fullName: 'Tài khoản kiểm thử', email: 'admin@example.com', department: 'Quản trị hệ thống' };
    else if (path === '/api/v1/events') body = { content: [], totalElements: 0, totalPages: 0 };
    else if (path.endsWith('/admin/dashboard')) body = {};
    else if (path.endsWith('/admin/badge-rules') || path.endsWith('/admin/badges')) {
      const pageNum = Number(new URL(request.url()).searchParams.get('page') || 0);
      const allItems = Array.from({ length: 11 }, (_, index) => ({
        badgeId: index + 1,
        id: String(index + 1),
        code: `BADGE${index + 1}`,
        name: `Huy hiệu ${String(index + 1).padStart(2, '0')}`,
        nameEn: `Badge ${index + 1}`,
        title: `Huy hiệu ${String(index + 1).padStart(2, '0')}`,
        description: 'Hoàn thành hoạt động để tích lũy điểm.',
        requiredPoints: index * 100,
        iconUrl: null,
        isActive: true,
        awardedUserCount: 0,
        remainingEligibleCount: 0,
        status: 'active',
        statusLabelVi: 'Đang áp dụng',
        perks: [],
        createdAt: '2026-10-25T01:00:00Z',
        updatedAt: '2026-10-25T01:00:00Z',
      }));
      const start = pageNum * 10;
      const content = allItems.slice(start, start + 10);
      body = {
        content,
        page: pageNum,
        size: 10,
        totalElements: allItems.length,
        totalPages: Math.ceil(allItems.length / 10),
      };
    }
    else if (path.endsWith('/participant/notifications')) {
      const allItems = Array.from({ length: 11 }, (_, index) => ({
        notificationId: index + 1,
        type: 'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED',
        title: `Thông báo ${String(index + 1).padStart(2, '0')}`,
        message: 'Cập nhật hoạt động',
        referenceType: 'ACTIVITY',
        referenceId: 90 + index,
        read: false,
        readAt: null,
        createdAt: '2026-10-25T01:00:00Z',
      }));
      const size = Number(new URL(request.url()).searchParams.get('size') || 20);
      const content = allItems.slice(0, size);
      body = { content, page: 0, size, totalElements: allItems.length, totalPages: Math.ceil(allItems.length / size) };
    }
    else if (path.endsWith('/participant/notifications/unread-count')) body = { unreadCount: 11 };
    else if (path.endsWith('/participant/event-registrations') || path.endsWith('/participant/activity-registrations')) {
      body = { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 };
    }
    await route.fulfill({ json: body });
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
  test(`Admin badge records use ten cards regardless of viewport at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockWorkspace(page, 'ADMIN');
    await page.goto('/admin/badges');
    const cards = page.locator('.badge-catalog-card');
    const pagination = page.getByRole('navigation', { name: 'pagination', exact: true });
    await expect(cards).toHaveCount(10);
    await pagination.getByRole('link', { name: 'Trang 2', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Huy hiệu 11');
    await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
    await pagination.getByRole('link', { name: 'Trang trước' }).click();
    await expect(cards).toHaveCount(10);
  });
}

test('Participant notification dropdown stays a compact preview and links to the workspace', async ({ page }) => {
  await mockWorkspace(page, 'PARTICIPANT');
  await page.goto('/participant');
  await page.locator('.participant-top-bar').getByRole('button', { name: 'Thông báo', exact: true }).click();
  const dropdown = page.getByRole('dialog', { name: 'Thông báo gần đây' });
  await expect(dropdown.locator('.notif-dropdown-item')).toHaveCount(5);
  await dropdown.getByRole('link', { name: 'Xem tất cả thông báo →' }).click();
  await expect(page).toHaveURL(/\/participant\/notifications$/);
});
