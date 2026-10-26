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
    else if (path.endsWith('/admin/badge-rules')) body = Array.from({ length: 11 }, (_, index) => ({
      id: String(index + 1), code: `BADGE${index + 1}`, name: `Huy hiệu ${String(index + 1).padStart(2, '0')}`,
      nameEn: `Badge ${index + 1}`, title: `Huy hiệu ${String(index + 1).padStart(2, '0')}`, iconName: 'award', minPoints: index * 100,
      status: 'active', statusLabelVi: 'Đang áp dụng', description: 'Hoàn thành hoạt động để tích lũy điểm.', perks: [],
    }));
    else if (path.endsWith('/participant/notifications')) {
      const content = Array.from({ length: 11 }, (_, index) => ({
        notificationId: index + 1,
        type: 'ACTIVITY_UPDATED',
        title: `Thông báo ${String(index + 1).padStart(2, '0')}`,
        message: 'Cập nhật hoạt động',
        referenceType: 'ACTIVITY',
        referenceId: 90 + index,
        read: false,
        readAt: null,
        createdAt: '2026-10-25T01:00:00Z',
      }));
      body = { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
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
    const cards = page.locator('.adm-badge-item-card');
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

test('Participant notification list keeps the eleventh notification reachable', async ({ page }) => {
  await mockWorkspace(page, 'PARTICIPANT');
  await page.goto('/participant/feedback');
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  const dropdown = page.getByRole('dialog', { name: 'Thông báo gần đây' });
  const items = dropdown.locator('.notif-dropdown-item');
  const pagination = dropdown.getByRole('navigation', { name: 'pagination', exact: true });
  await expect(items).toHaveCount(10);
  await pagination.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Thông báo 11');
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
});
